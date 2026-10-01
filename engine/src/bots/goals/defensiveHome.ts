import {
  PlanContext,
  SimState,
  bonusOf,
  isEnemyTerritory,
  mainCluster,
  neighborsOf,
  snapshotState,
  troopsIn,
} from '../planning/context';

export interface Home {
  continentId: number | null;
  ids: Set<number>;
}

const homeCache = new WeakMap<PlanContext, Home>();

function continentScore(
  ctx: PlanContext,
  state: SimState,
  continentId: number,
  territoryIds: number[],
): number {
  const bonus = bonusOf(ctx, continentId);
  if (bonus <= 0) return 0;
  let owned = 0;
  let ownTroops = 0;
  let enemyTroops = 0;
  for (const id of territoryIds) {
    if (state.owners.get(id) === ctx.botId) {
      owned++;
      ownTroops += troopsIn(state, id);
    } else if (isEnemyTerritory(ctx, state, id)) {
      enemyTroops += troopsIn(state, id);
    }
  }
  if (owned === 0) return 0;
  const share = owned / territoryIds.length;
  return (bonus * share * (ownTroops + 1)) / (ownTroops + enemyTroops + 1);
}

function computeHome(ctx: PlanContext): Home {
  const state = snapshotState(ctx);
  const held = new Set<number>();
  let bestId: number | null = null;
  let bestScore = 0;
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    if (
      bonusOf(ctx, continentId) > 0 &&
      territoryIds.every((id) => state.owners.get(id) === ctx.botId)
    ) {
      for (const id of territoryIds) held.add(id);
      continue;
    }
    const score = continentScore(ctx, state, continentId, territoryIds);
    if (score > bestScore) {
      bestScore = score;
      bestId = continentId;
    }
  }
  if (bestId === null)
    return {
      continentId: null,
      ids: held.size > 0 ? held : new Set(mainCluster(ctx, state)),
    };
  const continent = new Set(ctx.continentTerritories.get(bestId) ?? []);
  const ids = new Set<number>(held);
  for (const [id, ownerId] of state.owners) {
    if (ownerId !== ctx.botId) continue;
    if (continent.has(id) || neighborsOf(ctx, id).some((n) => continent.has(n)))
      ids.add(id);
  }
  return { continentId: bestId, ids };
}

export function defensiveHome(ctx: PlanContext): Home {
  let home = homeCache.get(ctx);
  if (!home) {
    home = computeHome(ctx);
    homeCache.set(ctx, home);
  }
  return home;
}
