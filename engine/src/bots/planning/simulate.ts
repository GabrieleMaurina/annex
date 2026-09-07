import { supplyHubTerritoryIds } from '../../game/mechanics';
import { connectedOwnedTerritories } from '../../game/world/connectivity';
import { expectedOutcome } from '../features/combat';
import { evaluateBoard } from './board';
import {
  PlanContext,
  SimState,
  cloneState,
  defenceDiceAt,
  hostileNeighborsOf,
  isBotBorder,
  isFriendly,
  neighborsOf,
  ownedClusters,
  ownedIds,
  snapshotState,
  strongestThreatAt,
  troopsIn,
} from './context';
import { partitionTargets, routeStack } from './route';
import { AttackStep, Deployment, FortifyMove, Objective } from './turnPlan';

export interface StackPlan {
  startId: number;
  route: number[];
  objectiveIndex: number;
}

export interface Candidate {
  objectives: Objective[];
  deployments: Deployment[];
  stacks: StackPlan[];
  fortifyHint?: number;
  stagingCosts?: { id: number; cost: number }[];
}

export interface SimResult {
  attackSteps: AttackStep[];
  fortify: FortifyMove | null;
  score: number;
  successProbability: number;
  projected: SimState;
  feasible: boolean;
}

const STEP_FLOOR = 0.5;
const HOPELESS_FLOOR = 0.3;
const CHAIN_FLOOR = 0.08;
const EXACT_COMBAT_CAP = 60;
const FEASIBILITY_RATIO = 0.55;

function stepOutcome(
  ctx: PlanContext,
  attackers: number,
  defenders: number,
  dice: number,
): { winProbability: number; attackerSurvivorsMean: number } {
  if (attackers <= EXACT_COMBAT_CAP && defenders <= EXACT_COMBAT_CAP)
    return expectedOutcome(ctx.game, attackers, defenders, dice);
  const lossPerDefender = dice === 3 ? 1.4 : 0.9;
  return {
    winProbability: attackers > defenders * 2 ? 0.98 : 0.6,
    attackerSurvivorsMean: Math.max(1, attackers - defenders * lossPerDefender),
  };
}

function applyDeployments(state: SimState, deployments: Deployment[]): void {
  for (const { territoryId, troops } of deployments) {
    state.troops.set(territoryId, troopsIn(state, territoryId) + troops);
  }
}

export function walkStack(
  ctx: PlanContext,
  state: SimState,
  stack: StackPlan,
  steps: AttackStep[],
): number {
  let cur = stack.startId;
  let objectiveProb = 1;
  let taken = 0;
  for (let i = 0; i < stack.route.length; i++) {
    if (taken >= ctx.params.maxPlanDepth) break;
    const next = stack.route[i];
    if (state.owners.get(cur) !== ctx.botId) break;
    if (state.owners.get(next) === ctx.botId) {
      cur = next;
      continue;
    }
    const attackers = troopsIn(state, cur) - 1;
    if (attackers < 1) break;
    const defenders = troopsIn(state, next);
    const outcome = stepOutcome(
      ctx,
      attackers,
      defenders,
      defenceDiceAt(ctx, next),
    );
    if (outcome.winProbability < HOPELESS_FLOOR) break;
    if (outcome.winProbability < STEP_FLOOR && i > 0) break;

    steps.push({
      startId: cur,
      endId: next,
      objectiveIndex: stack.objectiveIndex,
      minWinProb: Math.max(0.3, outcome.winProbability - 0.3),
    });
    objectiveProb *= outcome.winProbability;

    const defenderId = state.owners.get(next);
    if (defenderId !== undefined)
      state.damageByPlayer.set(
        defenderId,
        (state.damageByPlayer.get(defenderId) ?? 0) + defenders,
      );
    state.troopsLost += Math.max(0, attackers - outcome.attackerSurvivorsMean);

    const survivors = Math.max(1, Math.round(outcome.attackerSurvivorsMean));
    state.troops.set(cur, 1);
    state.owners.set(next, ctx.botId);
    state.troops.set(next, survivors);
    state.conquered = true;
    cur = next;
    taken++;

    if (outcome.winProbability < STEP_FLOOR) break;
    if (objectiveProb < CHAIN_FLOOR) break;
  }
  return objectiveProb;
}

function reachableOwned(
  ctx: PlanContext,
  state: SimState,
  fromId: number,
): Set<number> {
  if (ctx.game.fortification === 'Unrestricted')
    return new Set(ownedIds(state, ctx.botId));
  if (ctx.game.fortification === 'Neighboring')
    return new Set(
      neighborsOf(ctx, fromId).filter((n) => state.owners.get(n) === ctx.botId),
    );
  for (const cluster of ownedClusters(ctx, state))
    if (cluster.includes(fromId)) return new Set(cluster);
  return new Set([fromId]);
}

function bestFortify(
  ctx: PlanContext,
  state: SimState,
  hint: number | undefined,
): { move: FortifyMove | null; score: number } {
  const baseScore = evaluateBoard(ctx, state);
  const owned = ownedIds(state, ctx.botId);
  const borderTargets = owned
    .filter((id) => isBotBorder(ctx, state, id))
    .map((id) => ({
      id,
      deficit: strongestThreatAt(ctx, state, id) - troopsIn(state, id),
    }))
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 6)
    .map((t) => t.id);
  const targets =
    hint !== undefined && state.owners.get(hint) === ctx.botId
      ? [hint, ...borderTargets.filter((id) => id !== hint)]
      : borderTargets;

  const sources = owned
    .filter((id) => troopsIn(state, id) >= 2)
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))
    .slice(0, 10);

  if (!ctx.params.optimizeFortify) {
    const source = sources.find(
      (id) => !isBotBorder(ctx, state, id) && troopsIn(state, id) >= 3,
    );
    const target = targets[0];
    if (source !== undefined && target !== undefined && target !== source) {
      const reach = reachableOwned(ctx, state, source);
      if (reach.has(target))
        return {
          move: {
            startId: source,
            endId: target,
            troops: troopsIn(state, source) - 1,
          },
          score: baseScore,
        };
    }
    return { move: null, score: baseScore };
  }

  let best: FortifyMove | null = null;
  let bestScore = baseScore;
  for (const source of sources) {
    const reach = reachableOwned(ctx, state, source);
    for (const target of targets) {
      if (target === source || !reach.has(target)) continue;
      const troops = troopsIn(state, source) - 1;
      const trial = cloneState(state);
      trial.troops.set(source, 1);
      trial.troops.set(target, troopsIn(trial, target) + troops);
      let score = evaluateBoard(ctx, trial);
      if (target === hint) score += 3;
      if (score > bestScore) {
        bestScore = score;
        best = { startId: source, endId: target, troops };
      }
    }
  }
  return { move: best, score: bestScore };
}

export function simulateTurn(
  ctx: PlanContext,
  candidate: Candidate,
): SimResult {
  const state = snapshotState(ctx);
  applyDeployments(state, candidate.deployments);

  const attackSteps: AttackStep[] = [];
  let successProbability = 1;
  for (const stack of candidate.stacks)
    successProbability *= walkStack(ctx, state, stack, attackSteps);

  let feasible = candidate.stacks.length === 0;
  for (const objective of candidate.objectives) {
    if (objective.mustVisit.length === 0) continue;
    const captured = objective.mustVisit.filter(
      (id) => state.owners.get(id) === ctx.botId,
    ).length;
    if (
      captured / objective.mustVisit.length >= FEASIBILITY_RATIO &&
      state.conquered
    )
      feasible = true;
  }

  const hint = candidate.fortifyHint ?? candidate.objectives[0]?.fortifyHint;
  const fortify = bestFortify(ctx, state, hint);
  if (fortify.move) {
    state.troops.set(fortify.move.startId, 1);
    state.troops.set(
      fortify.move.endId,
      troopsIn(state, fortify.move.endId) + fortify.move.troops,
    );
  }

  return {
    attackSteps,
    fortify: fortify.move,
    score: fortify.score,
    successProbability,
    projected: state,
    feasible,
  };
}

export function supplyConnected(
  ctx: PlanContext,
  territoryId: number,
): boolean {
  if (ctx.game.supplyLines !== 'on') return true;
  return connectedOwnedTerritories(
    ctx.game,
    ctx.botId,
    supplyHubTerritoryIds(ctx.game, ctx.botId),
  ).has(territoryId);
}

export function pickStaging(
  ctx: PlanContext,
  state: SimState,
  mustVisit: Set<number>,
): number | null {
  const owned = ownedIds(state, ctx.botId).filter(
    (id) =>
      troopsIn(state, id) >= 2 &&
      hostileNeighborsOf(ctx, state, id).length > 0 &&
      supplyConnected(ctx, id),
  );
  if (owned.length === 0) return null;
  const adjacent = owned.filter((id) =>
    neighborsOf(ctx, id).some((n) => mustVisit.has(n)),
  );
  const pool = adjacent.length > 0 ? adjacent : owned;
  return pool.reduce((best, id) =>
    troopsIn(state, id) > troopsIn(state, best) ? id : best,
  );
}

function deepestTarget(
  ctx: PlanContext,
  state: SimState,
  mustVisit: number[],
): number | null {
  if (mustVisit.length < 2) return null;
  let best: number | null = null;
  let bestExposure = -1;
  for (const id of mustVisit) {
    let exposure = 0;
    for (const n of neighborsOf(ctx, id)) {
      if (mustVisit.includes(n)) continue;
      const ownerId = state.owners.get(n);
      if (ownerId !== undefined && !isFriendly(ctx, ownerId))
        exposure += troopsIn(state, n);
    }
    if (exposure > bestExposure) {
      bestExposure = exposure;
      best = id;
    }
  }
  return best;
}

export function defensiveDeployments(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Deployment[] {
  if (budget <= 0) return [];
  const borders = ownedIds(state, ctx.botId)
    .filter((id) => isBotBorder(ctx, state, id) && supplyConnected(ctx, id))
    .map((id) => ({
      id,
      deficit: Math.max(
        1,
        strongestThreatAt(ctx, state, id) - troopsIn(state, id),
      ),
    }))
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 3);
  if (borders.length === 0) {
    const fallback = ownedIds(state, ctx.botId)
      .filter((id) => supplyConnected(ctx, id))
      .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))[0];
    return fallback === undefined
      ? []
      : [{ territoryId: fallback, troops: budget }];
  }
  const total = borders.reduce((sum, b) => sum + b.deficit, 0);
  const deployments: Deployment[] = [];
  let assigned = 0;
  borders.forEach((border, index) => {
    const troops =
      index === borders.length - 1
        ? budget - assigned
        : Math.floor((budget * border.deficit) / total);
    if (troops > 0) {
      deployments.push({ territoryId: border.id, troops });
      assigned += troops;
    }
  });
  return deployments;
}

export function multiDeployments(
  ctx: PlanContext,
  state: SimState,
  stagings: { id: number; cost: number }[],
  budget: number,
): Deployment[] {
  if (budget <= 0) return [];
  const perStaging = new Map<number, number>();
  let spent = 0;
  for (const { id, cost } of stagings) {
    if (budget - spent <= 0) break;
    const need = Math.ceil(cost * 1.25) + 2 - troopsIn(state, id);
    if (need <= 0) continue;
    const give = Math.min(budget - spent, need);
    perStaging.set(id, (perStaging.get(id) ?? 0) + give);
    spent += give;
  }

  const reserve = budget - spent;
  const deployments: Deployment[] = [];
  if (reserve > 0) {
    const stagingIds = new Set(stagings.map((s) => s.id));
    let placed = 0;
    for (const d of defensiveDeployments(ctx, state, reserve)) {
      if (stagingIds.has(d.territoryId)) continue;
      deployments.push(d);
      placed += d.troops;
    }
    const leftover = reserve - placed;
    if (leftover > 0) {
      const first = stagings[0].id;
      perStaging.set(first, (perStaging.get(first) ?? 0) + leftover);
    }
  }

  for (const [id, troops] of perStaging)
    deployments.unshift({ territoryId: id, troops });
  return deployments;
}

export function offensiveDeployments(
  ctx: PlanContext,
  state: SimState,
  stagingId: number,
  budget: number,
  routeCost: number,
): Deployment[] {
  return multiDeployments(
    ctx,
    state,
    [{ id: stagingId, cost: routeCost }],
    budget,
  );
}

export function stackCandidates(
  ctx: PlanContext,
  state: SimState,
  objective: Objective,
  budget: number,
  stagingOverride?: number,
): Candidate[] {
  const mustVisit = new Set(objective.mustVisit);
  const staging =
    stagingOverride !== undefined &&
    state.owners.get(stagingOverride) === ctx.botId
      ? stagingOverride
      : pickStaging(ctx, state, mustVisit);
  if (staging === null) return [];

  const anchors: (number | null)[] = [null];
  const deep =
    objective.mustVisit.length <= 6
      ? deepestTarget(ctx, state, objective.mustVisit)
      : null;
  if (deep !== null && deep !== staging) anchors.push(deep);

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const anchor of anchors) {
    const route = routeStack(ctx, state, staging, objective.mustVisit, anchor);
    if (route.path.length === 0) continue;
    const key = route.path.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      objectives: [objective],
      deployments: offensiveDeployments(
        ctx,
        state,
        staging,
        budget,
        route.cost,
      ),
      stacks: [{ startId: staging, route: route.path, objectiveIndex: 0 }],
      fortifyHint: objective.fortifyHint,
      stagingCosts: [{ id: staging, cost: route.cost }],
    });
  }

  if (
    stagingOverride === undefined &&
    ctx.params.maxCampaigns >= 2 &&
    objective.mustVisit.length >= 4
  ) {
    const split = splitStackCandidate(ctx, state, objective, budget);
    if (split) candidates.push(split);
  }
  return candidates;
}

function splitStackCandidate(
  ctx: PlanContext,
  state: SimState,
  objective: Objective,
  budget: number,
): Candidate | null {
  const groups = partitionTargets(ctx, state, objective.mustVisit);
  if (groups.length < 2) return null;

  const stagings: number[] = [];
  const stacks: Candidate['stacks'] = [];
  const stagingCosts: { id: number; cost: number }[] = [];
  for (const group of groups) {
    const groupStaging = pickStaging(ctx, state, new Set(group));
    if (groupStaging === null || stagings.includes(groupStaging)) return null;
    const route = routeStack(ctx, state, groupStaging, group, null);
    if (route.path.length === 0) return null;
    stagings.push(groupStaging);
    stagingCosts.push({ id: groupStaging, cost: route.cost });
    stacks.push({
      startId: groupStaging,
      route: route.path,
      objectiveIndex: 0,
    });
  }

  return {
    objectives: [objective],
    deployments: multiDeployments(ctx, state, stagingCosts, budget),
    stacks,
    fortifyHint: objective.fortifyHint,
    stagingCosts,
  };
}
