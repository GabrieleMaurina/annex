import {
  PlanContext,
  SimState,
  botBorderIds,
  cloneState,
  isFriendly,
  isHazard,
  neighborsOf,
  troopsIn,
} from '../planning/context';

const NEUTRAL = -1;
const STACK_MIN_TROOPS = 6;
const STACK_MEAN_RATIO = 2;
const MAX_STACKS_PER_SIDE = 6;
const REACH_DEPTH = 2;
const DEPTH_DECAY = 0.5;
const FULL_REACH = 4;
const POWER_EXPONENT = 1.15;
const STRUCTURAL = Infinity;
const DUEL_OPEN_BOOST = 3;

export function openStackWeight(ctx: PlanContext): number {
  return (
    Math.max(0, 1 + ctx.weights.stack) + DUEL_OPEN_BOOST * ctx.duel.stacking
  );
}

function sameSide(ctx: PlanContext, a: number, b: number): boolean {
  return a === b || (isFriendly(ctx, a) && isFriendly(ctx, b));
}

export function stackReach(
  ctx: PlanContext,
  state: SimState,
  startId: number,
  attackers: number,
): Map<number, number> {
  const reach = new Map<number, number>();
  const ownerId = state.owners.get(startId);
  if (ownerId === undefined || attackers < 1) return reach;
  const seen = new Set<number>([startId]);
  let frontier = [startId];
  let weight = 1;
  for (let depth = 0; depth < REACH_DEPTH; depth++) {
    const next: number[] = [];
    for (const from of frontier) {
      for (const n of neighborsOf(ctx, from)) {
        if (seen.has(n)) continue;
        seen.add(n);
        const neighborOwner = state.owners.get(n);
        if (
          neighborOwner !== undefined &&
          sameSide(ctx, ownerId, neighborOwner)
        )
          continue;
        if (isHazard(ctx, n)) continue;
        const feasibility = Math.min(1, attackers / (troopsIn(state, n) + 1));
        const key = neighborOwner ?? NEUTRAL;
        reach.set(key, (reach.get(key) ?? 0) + weight * feasibility);
        next.push(n);
      }
    }
    frontier = next;
    weight *= DEPTH_DECAY;
  }
  return reach;
}

function reachTotal(
  reach: Map<number, number>,
  keep: (ownerId: number) => boolean = () => true,
): number {
  let total = 0;
  for (const [ownerId, value] of reach) if (keep(ownerId)) total += value;
  return total;
}

function opennessOf(reach: number): number {
  return Math.min(1, reach / FULL_REACH);
}

function stackPower(troops: number): number {
  return Math.pow(Math.max(0, troops - 1), POWER_EXPONENT);
}

function stackThreshold(state: SimState): number {
  let total = 0;
  for (const troops of state.troops.values()) total += troops;
  const mean = total / Math.max(1, state.troops.size);
  return Math.max(STACK_MIN_TROOPS, STACK_MEAN_RATIO * mean);
}

function largest(found: [number, number][]): number[] {
  return found
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_STACKS_PER_SIDE)
    .map(([id]) => id);
}

export interface StackScores {
  open: number;
  pressure: number;
  mass: number;
}

export function stackScores(ctx: PlanContext, state: SimState): StackScores {
  const threshold = stackThreshold(state);
  const own: [number, number][] = [];
  const enemy: [number, number][] = [];
  for (const [id, troops] of state.troops) {
    if (troops < threshold) continue;
    const ownerId = state.owners.get(id);
    if (ownerId === undefined) continue;
    if (ownerId === ctx.botId) own.push([id, troops]);
    else if (!isFriendly(ctx, ownerId)) enemy.push([id, troops]);
  }
  const scores: StackScores = { open: 0, pressure: 0, mass: 0 };
  if (openStackWeight(ctx) > 0)
    for (const id of largest(own)) {
      const troops = troopsIn(state, id);
      const reach = stackReach(ctx, state, id, troops - 1);
      scores.open += stackPower(troops) * opennessOf(reachTotal(reach));
    }
  for (const id of largest(enemy)) {
    const troops = troopsIn(state, id);
    const power = stackPower(troops);
    const reach = stackReach(ctx, state, id, troops - 1);
    scores.mass += power;
    scores.pressure +=
      power * opennessOf(reachTotal(reach, (o) => isFriendly(ctx, o)));
  }
  return scores;
}

export function isStackFight(
  ctx: PlanContext,
  state: SimState,
  startId: number,
  targetId: number,
): boolean {
  if (ctx.duel.rolling <= 0) return false;
  const ownerId = state.owners.get(targetId);
  const threshold = stackThreshold(state);
  return (
    state.owners.get(startId) === ctx.botId &&
    ownerId !== undefined &&
    !isFriendly(ctx, ownerId) &&
    troopsIn(state, startId) >= threshold &&
    troopsIn(state, targetId) >= threshold
  );
}

function borderReach(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  return reachTotal(stackReach(ctx, state, territoryId, STRUCTURAL));
}

export function mostOpenBorders(
  ctx: PlanContext,
  state: SimState,
  limit: number,
): number[] {
  return botBorderIds(ctx, state)
    .map((id) => ({ id, reach: borderReach(ctx, state, id) }))
    .sort(
      (a, b) =>
        b.reach - a.reach || troopsIn(state, b.id) - troopsIn(state, a.id),
    )
    .slice(0, limit)
    .map((entry) => entry.id);
}

export function bestStackingBorder(
  ctx: PlanContext,
  state: SimState,
  candidates: number[],
  budget: number,
): number | null {
  let best: number | null = null;
  let bestValue = 0;
  for (const id of candidates) {
    const value =
      opennessOf(borderReach(ctx, state, id)) * (troopsIn(state, id) + budget);
    if (value > bestValue) {
      bestValue = value;
      best = id;
    }
  }
  return best;
}

export function conquestEndShare(
  ctx: PlanContext,
  state: SimState,
  fromId: number,
  toId: number,
  attackers: number,
): number {
  const fromReach = reachTotal(stackReach(ctx, state, fromId, attackers));
  const toReach = reachTotal(stackReach(ctx, state, toId, attackers));
  const total = fromReach + toReach;
  return total > 0 ? toReach / total : 1;
}

export function openedEnemyStackPower(
  ctx: PlanContext,
  state: SimState,
  conqueredId: number,
): number {
  const threshold = stackThreshold(state);
  const touchesBot = (id: number) =>
    neighborsOf(ctx, id).some((n) => {
      const ownerId = state.owners.get(n);
      return ownerId !== undefined && isFriendly(ctx, ownerId);
    });
  let power = 0;
  for (const n of neighborsOf(ctx, conqueredId)) {
    const ownerId = state.owners.get(n);
    const troops = troopsIn(state, n);
    if (ownerId === undefined || isFriendly(ctx, ownerId)) continue;
    if (troops < threshold || touchesBot(n)) continue;
    power += troops - 1;
  }
  return power;
}

export function ownStackClosure(
  ctx: PlanContext,
  state: SimState,
  startId: number,
  endId: number,
): number {
  const troops = troopsIn(state, startId);
  if (troops < stackThreshold(state)) return 0;
  const attackers = troops - 1;
  const before = reachTotal(stackReach(ctx, state, startId, attackers));
  if (before <= 0) return 0;
  const projected = cloneState(state);
  projected.owners.set(endId, ctx.botId);
  const after = reachTotal(stackReach(ctx, projected, startId, attackers));
  return after > 0 ? 0 : opennessOf(before);
}
