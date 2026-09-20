import { attackWinProbability } from '../features/combat';
import { continentBreakCandidates } from '../features/continents';
import {
  PlanContext,
  SimState,
  defenceDiceAt,
  frontierStacks,
  hostileNeighborsOf,
  neighborsOf,
  troopsIn,
} from '../planning/context';
import { routeStack } from '../planning/route';
import {
  Candidate,
  StackPlan,
  multiDeployments,
  pickStaging,
  stackCandidates,
  supplyConnected,
} from '../planning/simulate';
import { Objective } from '../planning/turnPlan';

const MIN_FOCUS = 0.2;
const ROLL_MIN_TROOPS = 6;
const ROLL_MIN_RATIO = 0.5;
const ROLL_MIN_WIN = 0.55;
const MAX_ROLLERS = 3;

function frontierTarget(
  ctx: PlanContext,
  state: SimState,
  continentId: number,
  ownerId: number,
): number | null {
  let best: number | null = null;
  for (const id of ctx.continentTerritories.get(continentId) ?? []) {
    if (state.owners.get(id) !== ownerId) continue;
    if (!neighborsOf(ctx, id).some((n) => state.owners.get(n) === ctx.botId))
      continue;
    if (best === null || troopsIn(state, id) < troopsIn(state, best)) best = id;
  }
  return best;
}

interface BreakTarget {
  ownerId: number;
  continentId: number;
  territoryId: number;
  bonus: number;
  weakestId: number;
}

function breakTargets(ctx: PlanContext, state: SimState): BreakTarget[] {
  return continentBreakCandidates(ctx.game, ctx.view, ctx.botId)
    .map((c) => ({
      ownerId: c.ownerId,
      continentId: c.continentId,
      territoryId:
        frontierTarget(ctx, state, c.continentId, c.ownerId) ??
        c.weakestTerritoryId,
      bonus: c.bonus,
      weakestId: c.weakestTerritoryId,
    }))
    .sort((a, b) => b.bonus - a.bonus);
}

function breakObjective(targets: BreakTarget[]): Objective {
  return {
    kind: 'break',
    targetPlayerId: targets[0].ownerId,
    continentId: targets[0].continentId,
    mustVisit: targets.map((t) => t.territoryId),
  };
}

function multiBreakCandidate(
  ctx: PlanContext,
  state: SimState,
  targets: BreakTarget[],
  budget: number,
): Candidate | null {
  const stacks: StackPlan[] = [];
  const stagingCosts: { id: number; cost: number }[] = [];
  for (const target of targets) {
    const staging = pickStaging(ctx, state, new Set([target.territoryId]));
    if (staging === null) return null;
    const route = routeStack(ctx, state, staging, [target.territoryId], null);
    if (route.path.length === 0) return null;
    stacks.push({ startId: staging, route: route.path, objectiveIndex: 0 });
    stagingCosts.push({ id: staging, cost: route.cost });
  }
  return {
    objectives: [breakObjective(targets)],
    deployments: multiDeployments(ctx, state, stagingCosts, budget),
    stacks,
    stagingCosts,
  };
}

export function duelBreakCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  if (ctx.duel.breaking < MIN_FOCUS) return [];
  const targets = breakTargets(ctx, state);
  const nearest = targets
    .filter((t) => t.territoryId !== t.weakestId)
    .flatMap((t) => stackCandidates(ctx, state, breakObjective([t]), budget));
  const combos: Candidate[] = [];
  const limit = Math.min(targets.length, ctx.params.maxCampaigns);
  for (let count = 2; count <= limit; count++) {
    const combo = multiBreakCandidate(
      ctx,
      state,
      targets.slice(0, count),
      budget,
    );
    if (combo) combos.push(combo);
  }
  return [...nearest, ...combos];
}

export function rollCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  if (ctx.duel.rolling < MIN_FOCUS) return [];
  const candidates: Candidate[] = [];
  for (const from of frontierStacks(ctx, state, ROLL_MIN_TROOPS).slice(
    0,
    MAX_ROLLERS,
  )) {
    if (!supplyConnected(ctx, from)) continue;
    for (const to of hostileNeighborsOf(ctx, state, from)) {
      const ownerId = state.owners.get(to);
      const defenders = troopsIn(state, to);
      if (
        ownerId === undefined ||
        defenders < ROLL_MIN_TROOPS ||
        defenders < ROLL_MIN_RATIO * troopsIn(state, from)
      )
        continue;
      for (const candidate of stackCandidates(
        ctx,
        state,
        {
          kind: 'roll',
          targetPlayerId: ownerId,
          continentId: null,
          mustVisit: [to],
        },
        budget,
        from,
      )) {
        const deployed = candidate.deployments
          .filter((d) => d.territoryId === from)
          .reduce((sum, d) => sum + d.troops, 0);
        const winProbability = attackWinProbability(
          ctx.game,
          troopsIn(state, from) + deployed - 1,
          defenders,
          defenceDiceAt(ctx, to),
        );
        if (winProbability >= ROLL_MIN_WIN) candidates.push(candidate);
      }
    }
  }
  return candidates;
}
