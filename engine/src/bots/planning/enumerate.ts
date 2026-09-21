import { pickBestSet } from '../../game/progression/cards';
import { chooseCardSet } from '../heuristics/cards';
import { Weights } from '../types';
import { PlanContext, SimState, isFriendly, snapshotState } from './context';
import {
  eliminateMustVisitLimit,
  gatherCandidates,
  repairStaging,
} from './objectives';
import {
  Candidate,
  SimResult,
  multiDeployments,
  simulateTurn,
  walkStack,
} from './simulate';
import {
  AttackStep,
  Objective,
  ObjectiveKind,
  TurnPlan,
  emptyPlan,
} from './turnPlan';

const KIND_WEIGHT: Record<ObjectiveKind, (w: Weights) => number> = {
  complete: (w) => w.completeContinent,
  break: (w) => w.breakContinent,
  spoilContinent: (w) => w.breakContinent * 0.6,
  eliminate: (w) => w.eliminate,
  antiLeader: (w) => w.antiLeader,
  neutralizeThreat: (w) => w.defendFrontier,
  shrinkBorder: (w) => w.defense * 0.7,
  merge: (w) => w.defense * 0.7 + w.stack,
  holdChokepoint: (w) => w.holdChokepoint,
  card: () => 0.4,
  defensive: (w) => w.defense * 0.4,
  prey: (w) => w.stack * 0.3,
  roll: () => 0,
  capture: () => 2,
  expand: () => 1,
  deny: () => 2,
};

const DUEL_FINISHER_ELIMINATE_BONUS = 50;

function isDuelFinisher(ctx: PlanContext): boolean {
  if (!ctx.finisher) return false;
  const dead = new Set(ctx.game.deathOrder);
  const rivals = ctx.game.playerIds.filter(
    (id) => id !== ctx.botId && !dead.has(id) && !ctx.friendlyIds.has(id),
  );
  return rivals.length <= 1;
}

function personalityBonus(ctx: PlanContext, objectives: Objective[]): number {
  let bonus = 0;
  const duelFinisher = isDuelFinisher(ctx);
  objectives.forEach((objective, index) => {
    bonus +=
      1.4 * KIND_WEIGHT[objective.kind](ctx.weights) * (index === 0 ? 1 : 0.5);
    if (duelFinisher && index === 0 && objective.kind === 'eliminate')
      bonus += DUEL_FINISHER_ELIMINATE_BONUS;
  });
  return bonus;
}

function estimateCardBonus(ctx: PlanContext): number {
  const hand = ctx.game.playerCards.get(ctx.botId) ?? [];
  const best = pickBestSet(ctx.game, hand, ctx.botId);
  return best ? best.baseValue : 0;
}

function materialize(
  ctx: PlanContext,
  candidate: Candidate,
  result: SimResult,
  cardSet: (number | null)[] | null,
): TurnPlan {
  return {
    objectives: candidate.objectives,
    cardSet,
    cardSetPlayed: false,
    deployments: candidate.deployments,
    attackSteps: result.attackSteps,
    fortify: result.fortify,
    score: result.score,
    deployCursor: 0,
    step: 0,
    attacksIssued: 0,
    overwhelmingAttacksIssued: 0,
    shipAttacksIssued: 0,
    entrenchesIssued: 0,
    roundNumber: ctx.game.roundNumber,
    playerId: ctx.botId,
    topology: {
      neighbors: ctx.neighbors,
      seaLinks: ctx.seaLinks,
      continentTerritories: ctx.continentTerritories,
      territoryContinent: ctx.territoryContinent,
    },
  };
}

export function repairPlan(ctx: PlanContext, plan: TurnPlan): boolean {
  const step = plan.attackSteps[plan.step];
  if (!step) return false;
  const objective = plan.objectives[step.objectiveIndex];
  if (
    !objective ||
    objective.kind === 'defensive' ||
    objective.kind === 'card' ||
    objective.kind === 'holdChokepoint'
  )
    return false;

  const state = snapshotState(ctx);
  const remaining = objective.mustVisit
    .filter((id) => {
      const ownerId = state.owners.get(id);
      return ownerId === undefined || !isFriendly(ctx, ownerId);
    })
    .slice(0, eliminateMustVisitLimit(ctx, state));
  if (remaining.length === 0) return false;

  const routed = repairStaging(ctx, state, remaining);
  if (!routed) return false;

  const steps: AttackStep[] = [];
  walkStack(
    ctx,
    state,
    {
      startId: routed.staging,
      route: routed.route,
      objectiveIndex: step.objectiveIndex,
    },
    steps,
  );
  if (steps.length === 0) return false;

  plan.attackSteps = [...plan.attackSteps.slice(0, plan.step), ...steps];
  return true;
}

function stackTerritories(candidate: Candidate): Set<number> {
  const ids = new Set<number>();
  for (const stack of candidate.stacks) {
    ids.add(stack.startId);
    for (const id of stack.route) ids.add(id);
  }
  return ids;
}

function combine(
  ctx: PlanContext,
  state: SimState,
  base: Candidate,
  extra: Candidate,
  budget: number,
): Candidate | null {
  const baseTerr = stackTerritories(base);
  for (const id of stackTerritories(extra)) if (baseTerr.has(id)) return null;

  const stagingCosts = [
    ...(base.stagingCosts ?? []),
    ...(extra.stagingCosts ?? []),
  ];
  if (stagingCosts.length < 2) return null;
  const totalNeed = stagingCosts.reduce(
    (sum, c) => sum + Math.ceil(c.cost * 1.25) + 2,
    0,
  );
  if (totalNeed > budget * 1.4) return null;

  const baseIndex = base.objectives.length;
  return {
    objectives: [...base.objectives, extra.objectives[0]],
    deployments: multiDeployments(ctx, state, stagingCosts, budget),
    stacks: [
      ...base.stacks,
      ...extra.stacks.map((s) => ({ ...s, objectiveIndex: baseIndex })),
    ],
    fortifyHint: base.fortifyHint ?? extra.fortifyHint,
    stagingCosts,
  };
}

const MIN_CONFIDENCE = 0.15;
const FORTIFY_REFINE_COUNT = 5;

function confidentEnough(
  ctx: PlanContext,
  candidate: Candidate,
  result: SimResult,
): boolean {
  if (candidate.stacks.length === 0) return true;
  return (
    result.successProbability * ctx.params.planningConfidence >= MIN_CONFIDENCE
  );
}

export function buildTurnPlan(
  ctx: PlanContext,
  troopsToDeploy: number,
): TurnPlan {
  const state = snapshotState(ctx);
  const cardSet = chooseCardSet(ctx.game, ctx.botId);
  const budget = troopsToDeploy + (cardSet ? estimateCardBonus(ctx) : 0);
  const jitter = ctx.params.noise * 4;

  let bestPlan = emptyPlan(ctx.game.roundNumber, ctx.botId);
  bestPlan.cardSet = cardSet;
  let bestScore = -Infinity;
  let bestCandidate: Candidate | null = null;
  let bestRefined = false;
  const consider = (
    candidate: Candidate,
    result: SimResult,
    baseScore: number,
    refined = false,
  ) => {
    const score = baseScore + (Math.random() - 0.5) * jitter;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
      bestRefined = refined;
      bestPlan = materialize(ctx, candidate, result, cardSet);
    }
  };

  const scored = gatherCandidates(ctx, state, budget).map((candidate) => {
    const result = simulateTurn(ctx, candidate, false);
    const feasible =
      result.feasible || candidate.objectives[0].kind === 'defensive';
    return { candidate, result, feasible, refined: false };
  });

  if (ctx.params.optimizeFortify)
    scored
      .filter((e) => e.feasible && confidentEnough(ctx, e.candidate, e.result))
      .sort(
        (a, b) =>
          b.result.score +
          personalityBonus(ctx, b.candidate.objectives) -
          (a.result.score + personalityBonus(ctx, a.candidate.objectives)),
      )
      .slice(0, FORTIFY_REFINE_COUNT)
      .forEach((entry) => {
        entry.result = simulateTurn(ctx, entry.candidate, true);
        entry.refined = true;
      });

  for (const entry of scored) {
    if (!entry.feasible) continue;
    if (!confidentEnough(ctx, entry.candidate, entry.result)) continue;
    consider(
      entry.candidate,
      entry.result,
      entry.result.score + personalityBonus(ctx, entry.candidate.objectives),
      entry.refined,
    );
  }

  if (ctx.params.maxCampaigns >= 2 && budget >= 8 && !ctx.finisher) {
    const offensive = scored
      .filter(
        (e) =>
          e.feasible &&
          e.candidate.stacks.length > 0 &&
          e.candidate.stagingCosts,
      )
      .map((e) => ({
        candidate: e.candidate,
        score: e.result.score + personalityBonus(ctx, e.candidate.objectives),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    let comboSims = 0;
    for (let i = 0; i < offensive.length && comboSims < 10; i++) {
      for (let j = i + 1; j < offensive.length && comboSims < 10; j++) {
        const pair = combine(
          ctx,
          state,
          offensive[i].candidate,
          offensive[j].candidate,
          budget,
        );
        if (!pair) continue;
        comboSims++;
        const pairResult = simulateTurn(ctx, pair, false);
        if (!pairResult.feasible) continue;
        if (!confidentEnough(ctx, pair, pairResult)) continue;
        consider(
          pair,
          pairResult,
          pairResult.score + personalityBonus(ctx, pair.objectives),
        );
        if (ctx.params.maxCampaigns < 3) continue;
        for (let k = j + 1; k < offensive.length && comboSims < 10; k++) {
          const trio = combine(
            ctx,
            state,
            pair,
            offensive[k].candidate,
            budget,
          );
          if (!trio) continue;
          comboSims++;
          const trioResult = simulateTurn(ctx, trio, false);
          if (trioResult.feasible && confidentEnough(ctx, trio, trioResult))
            consider(
              trio,
              trioResult,
              trioResult.score + personalityBonus(ctx, trio.objectives),
            );
        }
      }
    }
  }

  if (ctx.params.optimizeFortify && bestCandidate && !bestRefined)
    bestPlan = materialize(
      ctx,
      bestCandidate,
      simulateTurn(ctx, bestCandidate, true),
      cardSet,
    );

  const needsCard = ctx.personality !== 'defensive' || ctx.game.cards !== 'Off';
  if (needsCard && bestPlan.objectives[0]?.kind === 'defensive') {
    const cardEntry = scored.find(
      (e) =>
        e.feasible &&
        e.candidate.objectives[0]?.kind === 'card' &&
        confidentEnough(ctx, e.candidate, e.result),
    );
    if (cardEntry)
      bestPlan = materialize(
        ctx,
        cardEntry.candidate,
        cardEntry.result,
        cardSet,
      );
  }

  return bestPlan;
}
