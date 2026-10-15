import {
  PlanContext,
  SimState,
  isBotBorder,
  isEnemyTerritory,
  isFriendly,
  neighborsOf,
  ownedIds,
  troopsIn,
} from '../../planning/context';
import { stalematePressure } from '../pressure';
import { isCapitalOf } from '../territory';

const THREAT_HOPS = 3;
const THREAT_DECAY = 0.7;
const THREAT_MARGIN = 1.2;
const RIVAL_MATCH = 1;
const RIVAL_ARMY_CAP = 0.7;
const ARMY_SHARE = 0.4;
const SORTIE_MIN_TROOPS = 12;

export function guardedCapitals(ctx: PlanContext): number[] {
  return [...ctx.game.capitalTerritoryIds].filter((id) =>
    isCapitalOf(ctx.game, ctx.botId, id),
  );
}

export function sortieCapitals(ctx: PlanContext, state: SimState): number[] {
  if (ctx.game.fortification === 'neighboring') return [];
  return guardedCapitals(ctx).filter(
    (id) =>
      troopsIn(state, id) >= SORTIE_MIN_TROOPS && isBotBorder(ctx, state, id),
  );
}

function reachThreat(
  ctx: PlanContext,
  state: SimState,
  capitalId: number,
): number {
  const seen = new Set([capitalId]);
  let frontier = [capitalId];
  let weight = 1;
  let worst = 0;
  for (let hop = 0; hop < THREAT_HOPS; hop++) {
    const next: number[] = [];
    for (const id of frontier)
      for (const n of neighborsOf(ctx, id)) {
        if (seen.has(n)) continue;
        seen.add(n);
        next.push(n);
        if (isEnemyTerritory(ctx, state, n))
          worst = Math.max(worst, weight * troopsIn(state, n));
      }
    frontier = next;
    weight *= THREAT_DECAY;
  }
  return worst;
}

function rivalCapitalStack(ctx: PlanContext, state: SimState): number {
  let largest = 0;
  for (const id of ctx.game.capitalTerritoryIds) {
    const ownerId = state.owners.get(id);
    if (ownerId === undefined || isFriendly(ctx, ownerId)) continue;
    largest = Math.max(largest, troopsIn(state, id));
  }
  return largest;
}

interface CapitalTarget {
  danger: number;
  comfort: number;
}

function capitalTarget(
  ctx: PlanContext,
  state: SimState,
  capitalId: number,
  guarded: number,
): CapitalTarget {
  const army = ownedIds(state, ctx.botId).reduce(
    (sum, id) => sum + troopsIn(state, id),
    0,
  );
  const relief = 1 - stalematePressure(ctx.game);
  return {
    danger: relief * THREAT_MARGIN * reachThreat(ctx, state, capitalId),
    comfort:
      relief *
      Math.max(
        Math.min(
          RIVAL_MATCH * rivalCapitalStack(ctx, state),
          RIVAL_ARMY_CAP * army,
        ),
        (ARMY_SHARE * army) / guarded,
      ),
  };
}

export function capitalReserve(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  if (state.owners.get(territoryId) !== ctx.botId) return 0;
  const capitals = guardedCapitals(ctx);
  if (!capitals.includes(territoryId)) return 0;
  const target = capitalTarget(ctx, state, territoryId, capitals.length);
  return Math.max(target.danger, target.comfort);
}

export function capitalGap(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  return Math.max(
    0,
    capitalReserve(ctx, state, territoryId) - troopsIn(state, territoryId),
  );
}

export function capitalShortfall(ctx: PlanContext, state: SimState): number {
  const capitals = guardedCapitals(ctx);
  let shortfall = 0;
  for (const id of capitals) {
    const target = capitalTarget(ctx, state, id, capitals.length);
    const troops = state.owners.get(id) === ctx.botId ? troopsIn(state, id) : 0;
    shortfall +=
      Math.max(0, target.danger - troops) +
      Math.max(0, target.comfort - troops);
  }
  return shortfall;
}

export function heldRivalCapitals(ctx: PlanContext, state: SimState): number {
  if (ctx.game.gameMode !== 'capitals') return 0;
  let held = 0;
  for (const id of ctx.game.capitalTerritoryIds) {
    if (state.owners.get(id) !== ctx.botId) continue;
    if (ctx.game.territoryOwners.get(id) === ctx.botId) continue;
    const threat = THREAT_MARGIN * reachThreat(ctx, state, id);
    held += threat > 0 ? Math.min(1, troopsIn(state, id) / threat) : 1;
  }
  return held;
}
