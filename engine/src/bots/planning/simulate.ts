import {
  MAX_TERRITORY_TROOPS,
  supplyHubTerritoryIds,
} from '../../game/mechanics';
import { connectedFortifyTerritories } from '../../game/world/connectivity';
import { expectedOutcome } from '../features/combat';
import {
  bestStackingBorder,
  conquestEndShare,
  isStackFight,
  mostOpenBorders,
  openStackWeight,
} from '../goals/stackOpenness';
import { evaluateBoard } from './board';
import {
  PlanContext,
  SimState,
  botBorderIds,
  cloneState,
  defenceDiceAt,
  hostileNeighborsOf,
  isBotBorder,
  isFriendly,
  neighborsOf,
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
  siege?: boolean;
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
const ROLL_DEFEAT_SURVIVAL = 0.5;

interface RollAttempt {
  stack: StackPlan;
  ownerId: number | undefined;
  defenders: number;
  attackers: number;
}

function stepOutcome(
  ctx: PlanContext,
  attackers: number,
  defenders: number,
  dice: number,
): { winProbability: number; attackerSurvivorsMean: number } {
  if (attackers <= EXACT_COMBAT_CAP && defenders <= EXACT_COMBAT_CAP)
    return expectedOutcome(ctx.game, attackers, defenders, dice);
  const scale = EXACT_COMBAT_CAP / Math.max(attackers, defenders);
  const scaledAttackers = Math.max(1, Math.round(attackers * scale));
  const scaledDefenders = Math.max(1, Math.round(defenders * scale));
  const outcome = expectedOutcome(
    ctx.game,
    scaledAttackers,
    scaledDefenders,
    dice,
  );
  return {
    winProbability: outcome.winProbability,
    attackerSurvivorsMean: Math.max(1, outcome.attackerSurvivorsMean / scale),
  };
}

function applyDeployments(state: SimState, deployments: Deployment[]): void {
  for (const { territoryId, troops } of deployments) {
    state.troops.set(territoryId, troopsIn(state, territoryId) + troops);
  }
}

function settleConquest(
  ctx: PlanContext,
  state: SimState,
  fromId: number,
  toId: number,
): void {
  const survivors = troopsIn(state, toId);
  if (survivors < 2) return;
  const share = conquestEndShare(ctx, state, fromId, toId, survivors);
  const moved = 1 + Math.round((survivors - 1) * share);
  state.troops.set(toId, moved);
  state.troops.set(fromId, troopsIn(state, fromId) + survivors - moved);
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
  let lastConquest: { fromId: number; toId: number } | null = null;
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
    if (defenderId !== undefined) {
      state.damageByPlayer.set(
        defenderId,
        (state.damageByPlayer.get(defenderId) ?? 0) + defenders,
      );
      state.conquestsByPlayer.set(
        defenderId,
        (state.conquestsByPlayer.get(defenderId) ?? 0) + 1,
      );
    }
    state.troopsLost += Math.max(0, attackers - outcome.attackerSurvivorsMean);

    const survivors = Math.max(1, Math.round(outcome.attackerSurvivorsMean));
    state.troops.set(cur, 1);
    state.owners.set(next, ctx.botId);
    state.troops.set(next, survivors);
    state.conquered = true;
    lastConquest = { fromId: cur, toId: next };
    cur = next;
    taken++;

    if (outcome.winProbability < STEP_FLOOR) break;
    if (objectiveProb < CHAIN_FLOOR) break;
  }
  if (lastConquest)
    settleConquest(ctx, state, lastConquest.fromId, lastConquest.toId);
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
  const reached = new Set<number>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of [
      ...neighborsOf(ctx, current),
      ...(ctx.seaLinks.get(current) ?? []),
    ]) {
      if (reached.has(n)) continue;
      if (state.owners.get(n) !== ctx.botId && !ctx.shippedSeaIds.has(n))
        continue;
      reached.add(n);
      queue.push(n);
    }
  }
  return reached;
}

function stepToward(
  ctx: PlanContext,
  state: SimState,
  from: number,
  to: number,
): number | null {
  const visited = new Set<number>([to]);
  const queue = [to];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of neighborsOf(ctx, current)) {
      if (visited.has(n) || state.owners.get(n) !== ctx.botId) continue;
      if (n === from) return current;
      visited.add(n);
      queue.push(n);
    }
  }
  return null;
}

function siegeMove(
  ctx: PlanContext,
  state: SimState,
  sources: number[],
  bridgehead: number,
): FortifyMove | null {
  const bridgeheadTroops = troopsIn(state, bridgehead);
  for (const source of sources) {
    if (troopsIn(state, source) <= bridgeheadTroops) break;
    const target =
      ctx.game.fortification === 'Neighboring'
        ? stepToward(ctx, state, source, bridgehead)
        : bridgehead;
    if (target === null || !reachableOwned(ctx, state, source).has(target))
      continue;
    const troops = Math.min(
      troopsIn(state, source) - 1,
      MAX_TERRITORY_TROOPS - troopsIn(state, target),
    );
    if (troops >= 1) return { startId: source, endId: target, troops };
  }
  return null;
}

function bestFortify(
  ctx: PlanContext,
  state: SimState,
  hint: number | undefined,
  siege: boolean | undefined,
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
  const openTargets =
    openStackWeight(ctx) > 0
      ? mostOpenBorders(ctx, state, 2).filter(
          (id) => !borderTargets.includes(id),
        )
      : [];
  const allTargets = [...borderTargets, ...openTargets];
  const targets =
    hint !== undefined && state.owners.get(hint) === ctx.botId
      ? [hint, ...allTargets.filter((id) => id !== hint)]
      : allTargets;

  const sources = owned
    .filter((id) => troopsIn(state, id) >= 2)
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))
    .slice(0, 10);

  if (siege && hint !== undefined && state.owners.get(hint) === ctx.botId) {
    const move = siegeMove(ctx, state, sources, hint);
    if (move) return { move, score: baseScore };
  }

  if (!ctx.params.optimizeFortify) {
    const source = sources.find(
      (id) => !isBotBorder(ctx, state, id) && troopsIn(state, id) >= 3,
    );
    const target = targets[0];
    if (source !== undefined && target !== undefined && target !== source) {
      const reach = reachableOwned(ctx, state, source);
      const troops = Math.min(
        troopsIn(state, source) - 1,
        MAX_TERRITORY_TROOPS - troopsIn(state, target),
      );
      if (reach.has(target) && troops >= 1)
        return {
          move: { startId: source, endId: target, troops },
          score: baseScore,
        };
    }
    return { move: null, score: baseScore };
  }

  let best: FortifyMove | null = null;
  let bestScore = baseScore;
  for (const source of sources) {
    const reach = reachableOwned(ctx, state, source);
    const sourceTroops = troopsIn(state, source);
    for (const target of targets) {
      if (target === source || !reach.has(target)) continue;
      const targetTroops = troopsIn(state, target);
      const troops = Math.min(
        sourceTroops - 1,
        MAX_TERRITORY_TROOPS - targetTroops,
      );
      if (troops < 1) continue;
      state.troops.set(source, 1);
      state.troops.set(target, targetTroops + troops);
      let score = evaluateBoard(ctx, state);
      state.troops.set(source, sourceTroops);
      state.troops.set(target, targetTroops);
      if (target === hint) score += 3;
      if (score > bestScore) {
        bestScore = score;
        best = { startId: source, endId: target, troops };
      }
    }
  }
  return { move: best, score: bestScore };
}

function blendRollScore(
  ctx: PlanContext,
  roll: RollAttempt,
  defeat: SimState,
  winProbability: number,
  victoryScore: number,
): number {
  const targetId = roll.stack.route[0];
  if (roll.ownerId !== undefined) defeat.owners.set(targetId, roll.ownerId);
  defeat.troops.set(
    targetId,
    Math.max(1, Math.round(roll.defenders * ROLL_DEFEAT_SURVIVAL)),
  );
  defeat.troops.set(roll.stack.startId, 1);
  defeat.troopsLost += roll.attackers;
  return (
    winProbability * victoryScore +
    (1 - winProbability) * evaluateBoard(ctx, defeat)
  );
}

export function simulateTurn(
  ctx: PlanContext,
  candidate: Candidate,
): SimResult {
  const state = snapshotState(ctx);
  applyDeployments(state, candidate.deployments);

  const rollStack = candidate.stacks.find(
    (stack) =>
      candidate.objectives[stack.objectiveIndex].kind === 'roll' ||
      isStackFight(ctx, state, stack.startId, stack.route[0]),
  );
  const roll: RollAttempt | null = rollStack
    ? {
        stack: rollStack,
        ownerId: state.owners.get(rollStack.route[0]),
        defenders: troopsIn(state, rollStack.route[0]),
        attackers: troopsIn(state, rollStack.startId) - 1,
      }
    : null;

  const attackSteps: AttackStep[] = [];
  let successProbability = 1;
  let rollProbability = 1;
  for (const stack of candidate.stacks) {
    const probability = walkStack(ctx, state, stack, attackSteps);
    successProbability *= probability;
    if (stack === rollStack) rollProbability = probability;
  }
  const defeat = roll ? cloneState(state) : null;

  let feasible = candidate.stacks.length === 0;
  for (const objective of candidate.objectives) {
    if (objective.mustVisit.length === 0) continue;
    const captured = objective.mustVisit.filter(
      (id) => state.owners.get(id) === ctx.botId,
    ).length;
    const required = Math.min(
      Math.ceil(objective.mustVisit.length * FEASIBILITY_RATIO),
      ctx.params.maxPlanDepth,
    );
    if (captured >= required && state.conquered) feasible = true;
  }

  const hint = candidate.fortifyHint ?? candidate.objectives[0]?.fortifyHint;
  const fortify = bestFortify(ctx, state, hint, candidate.siege);
  if (fortify.move) {
    state.troops.set(fortify.move.startId, 1);
    state.troops.set(
      fortify.move.endId,
      troopsIn(state, fortify.move.endId) + fortify.move.troops,
    );
  }

  const score =
    roll && defeat
      ? blendRollScore(ctx, roll, defeat, rollProbability, fortify.score)
      : fortify.score;

  return {
    attackSteps,
    fortify: fortify.move,
    score,
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
  return connectedFortifyTerritories(
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
  const border = ownedIds(state, ctx.botId).filter(
    (id) =>
      hostileNeighborsOf(ctx, state, id).length > 0 && supplyConnected(ctx, id),
  );
  const stacked = border.filter((id) => troopsIn(state, id) >= 2);
  const owned = stacked.length > 0 ? stacked : border;
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
  const maxBorders = ctx.personality === 'defensive' ? Infinity : 3;
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
    .slice(0, maxBorders);
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

export function openStackDeployments(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Deployment[] {
  if (budget <= 0 || openStackWeight(ctx) <= 0) return [];
  const borders = botBorderIds(ctx, state).filter((id) =>
    supplyConnected(ctx, id),
  );
  const target = bestStackingBorder(ctx, state, borders, budget);
  return target === null ? [] : [{ territoryId: target, troops: budget }];
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
