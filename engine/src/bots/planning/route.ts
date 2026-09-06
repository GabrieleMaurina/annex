import {
  PlanContext,
  SimState,
  defenceDiceAt,
  isFriendly,
  isHazard,
  neighborsOf,
  troopsIn,
} from './context';

export interface RouteResult {
  path: number[];
  cost: number;
  reachesAll: boolean;
}

function conquerCost(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  const defenders = troopsIn(state, territoryId);
  const perDefender = defenceDiceAt(ctx, territoryId) === 3 ? 1.4 : 0.95;
  return 1 + defenders * perDefender;
}

function isConquerable(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  if (isHazard(ctx, territoryId)) return false;
  const ownerId = state.owners.get(territoryId);
  if (ownerId === undefined) return true;
  return !isFriendly(ctx, ownerId);
}

interface Leg {
  path: number[];
  cost: number;
}

function shortestLegs(
  ctx: PlanContext,
  state: SimState,
  fromId: number,
  costCache: Map<number, number>,
  blocked?: Set<number>,
): Map<number, Leg> {
  const dist = new Map<number, number>([[fromId, 0]]);
  const prev = new Map<number, number>();
  const visited = new Set<number>();
  const frontier: number[] = [fromId];

  while (frontier.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (
        (dist.get(frontier[i]) ?? Infinity) <
        (dist.get(frontier[bestIndex]) ?? Infinity)
      )
        bestIndex = i;
    }
    const current = frontier.splice(bestIndex, 1)[0];
    if (visited.has(current)) continue;
    visited.add(current);

    for (const next of neighborsOf(ctx, current)) {
      if (visited.has(next)) continue;
      if (blocked?.has(next)) continue;
      if (next !== fromId && !isConquerable(ctx, state, next)) continue;
      let stepCost = costCache.get(next);
      if (stepCost === undefined) {
        stepCost = conquerCost(ctx, state, next);
        costCache.set(next, stepCost);
      }
      const candidate = (dist.get(current) ?? Infinity) + stepCost;
      if (candidate < (dist.get(next) ?? Infinity)) {
        dist.set(next, candidate);
        prev.set(next, current);
        frontier.push(next);
      }
    }
  }

  const legs = new Map<number, Leg>();
  for (const [target, cost] of dist) {
    if (target === fromId) continue;
    const path: number[] = [];
    let node: number | undefined = target;
    while (node !== undefined && node !== fromId) {
      path.unshift(node);
      node = prev.get(node);
    }
    if (node === fromId) legs.set(target, { path, cost });
  }
  return legs;
}

function orderTargets(
  startId: number,
  targets: number[],
  anchorId: number | null,
  legsByNode: Map<number, Map<number, Leg>>,
): number[] | null {
  const legCost = (a: number, b: number): number =>
    legsByNode.get(a)?.get(b)?.cost ?? Infinity;

  const free =
    anchorId === null ? targets : targets.filter((t) => t !== anchorId);

  if (free.length <= 6) {
    let best: number[] | null = null;
    let bestCost = Infinity;
    const permute = (chosen: number[], rest: number[]) => {
      if (rest.length === 0) {
        const order = anchorId === null ? chosen : [...chosen, anchorId];
        let cost = 0;
        let node = startId;
        let ok = true;
        for (const next of order) {
          const step = legCost(node, next);
          if (!isFinite(step)) {
            ok = false;
            break;
          }
          cost += step;
          node = next;
        }
        if (ok && cost < bestCost) {
          bestCost = cost;
          best = order;
        }
        return;
      }
      for (let i = 0; i < rest.length; i++) {
        permute(
          [...chosen, rest[i]],
          [...rest.slice(0, i), ...rest.slice(i + 1)],
        );
      }
    };
    permute([], free);
    return best;
  }

  const remaining = new Set(free);
  const order: number[] = [];
  let node = startId;
  while (remaining.size > 0) {
    let nearest: number | null = null;
    let nearestCost = Infinity;
    for (const candidate of remaining) {
      const cost = legCost(node, candidate);
      if (cost < nearestCost) {
        nearestCost = cost;
        nearest = candidate;
      }
    }
    if (nearest === null) break;
    order.push(nearest);
    remaining.delete(nearest);
    node = nearest;
  }
  if (remaining.size > 0) return null;
  if (anchorId !== null) order.push(anchorId);
  return order;
}

export function routeStack(
  ctx: PlanContext,
  state: SimState,
  startId: number,
  mustVisit: Iterable<number>,
  anchorId: number | null,
): RouteResult {
  const targetSet = new Set<number>();
  for (const id of mustVisit) if (id !== startId) targetSet.add(id);
  if (anchorId !== null && anchorId !== startId) targetSet.add(anchorId);
  const targets = [...targetSet];
  if (targets.length === 0) return { path: [], cost: 0, reachesAll: true };

  const costCache = new Map<number, number>();
  const legsByNode = new Map<number, Map<number, Leg>>();
  legsByNode.set(startId, shortestLegs(ctx, state, startId, costCache));
  for (const target of targets)
    legsByNode.set(target, shortestLegs(ctx, state, target, costCache));

  const order = orderTargets(startId, targets, anchorId, legsByNode);
  if (order === null) {
    const legs = legsByNode.get(startId)!;
    const reachable = targets.filter((t) => legs.has(t));
    const fallback = orderTargets(startId, reachable, null, legsByNode);
    if (fallback === null) return { path: [], cost: 0, reachesAll: false };
    return stitch(ctx, state, startId, fallback, false);
  }
  return stitch(ctx, state, startId, order, true);
}

function hopDistances(
  ctx: PlanContext,
  fromId: number,
  allowed: (id: number) => boolean,
): Map<number, number> {
  const dist = new Map<number, number>([[fromId, 0]]);
  let frontier = [fromId];
  let depth = 0;
  while (frontier.length > 0) {
    depth++;
    const next: number[] = [];
    for (const current of frontier) {
      for (const n of neighborsOf(ctx, current)) {
        if (dist.has(n)) continue;
        if (n !== fromId && !allowed(n)) continue;
        dist.set(n, depth);
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}

export function partitionTargets(
  ctx: PlanContext,
  state: SimState,
  targets: number[],
): number[][] {
  if (targets.length < 4) return [targets];
  const allowed = (id: number) =>
    isConquerable(ctx, state, id) || state.owners.get(id) === ctx.botId;

  const fromFirst = hopDistances(ctx, targets[0], allowed);
  const seedA = targets.reduce((a, b) =>
    (fromFirst.get(b) ?? Infinity) > (fromFirst.get(a) ?? Infinity) ? b : a,
  );
  const fromA = hopDistances(ctx, seedA, allowed);
  const seedB = targets.reduce((a, b) =>
    (fromA.get(b) ?? Infinity) > (fromA.get(a) ?? Infinity) ? b : a,
  );
  if (seedA === seedB) return [targets];
  const fromB = hopDistances(ctx, seedB, allowed);

  const groupA: number[] = [];
  const groupB: number[] = [];
  for (const t of targets) {
    const da = fromA.get(t) ?? Infinity;
    const db = fromB.get(t) ?? Infinity;
    (da <= db ? groupA : groupB).push(t);
  }
  if (groupA.length === 0 || groupB.length === 0) return [targets];
  return [groupA, groupB];
}

function stitch(
  ctx: PlanContext,
  state: SimState,
  startId: number,
  order: number[],
  reachesAll: boolean,
): RouteResult {
  const path: number[] = [];
  const inPath = new Set<number>([startId]);
  const costCache = new Map<number, number>();
  let node = startId;
  let cost = 0;
  for (const target of order) {
    if (inPath.has(target)) continue;
    const leg = shortestLegs(ctx, state, node, costCache, inPath).get(target);
    if (!leg) return { path, cost, reachesAll: false };
    for (const step of leg.path) {
      inPath.add(step);
      path.push(step);
      cost += conquerCost(ctx, state, step);
    }
    node = target;
  }
  return { path, cost, reachesAll };
}
