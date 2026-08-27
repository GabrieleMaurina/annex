import { maps } from '../../../maps';
import { Game, GameMap } from '../../../types';
import { shuffle } from '../mechanics';

const MAX_PORTALS = 6;
const TERRITORIES_PER_PORTAL = 10;
const SELECTION_ATTEMPTS = 30;

function continentCount(map: GameMap): number {
  return new Set(map.territories.map((t) => t.continentId)).size;
}

export function portalCount(map: GameMap): number {
  const base = Math.min(
    MAX_PORTALS,
    Math.ceil(map.territories.length / TERRITORIES_PER_PORTAL),
  );
  return Math.min(base, continentCount(map));
}

export function selectPortalTerritories(
  map: GameMap,
  count: number,
  exclude: Set<number> = new Set(),
): number[] {
  const neighborsById = new Map(
    map.territories.map((t) => [t.id, t.neighbors]),
  );
  const continentById = new Map(
    map.territories.map((t) => [t.id, t.continentId]),
  );
  const eligibleIds = map.territories
    .map((t) => t.id)
    .filter((id) => !exclude.has(id));

  let best: number[] = [];
  for (
    let attempt = 0;
    attempt < SELECTION_ATTEMPTS && best.length < count;
    attempt++
  ) {
    const chosen: number[] = [];
    const blockedTerritories = new Set<number>();
    const usedContinents = new Set<number>();
    for (const id of shuffle(eligibleIds)) {
      if (chosen.length >= count) break;
      if (blockedTerritories.has(id)) continue;
      const continentId = continentById.get(id)!;
      if (usedContinents.has(continentId)) continue;
      chosen.push(id);
      usedContinents.add(continentId);
      for (const n of neighborsById.get(id) ?? []) blockedTerritories.add(n);
    }
    if (chosen.length > best.length) best = chosen;
  }
  return best;
}

export function initializePortals(game: Game) {
  if (game.portals === 'off') {
    game.portalTerritoryIds = [];
    game.portalsEnabled = false;
    return;
  }
  const map = maps.get(game.mapName)!;
  game.portalTerritoryIds = selectPortalTerritories(
    map,
    portalCount(map),
    game.radiationTerritoryIds,
  );
  game.portalsEnabled = game.portals === 'static';
}

export function removePortalTerritory(game: Game, territoryId: number): void {
  if (!game.portalTerritoryIds.includes(territoryId)) return;
  game.portalTerritoryIds = game.portalTerritoryIds.filter(
    (id) => id !== territoryId,
  );
  if (game.portalTerritoryIds.length === 1) game.portalTerritoryIds = [];
}

export function withPortalEdges(
  neighbors: number[],
  territoryId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): number[] {
  if (!portalsEnabled || portalTerritoryIds.length < 2) return neighbors;
  if (!portalTerritoryIds.includes(territoryId)) return neighbors;
  return [
    ...neighbors,
    ...portalTerritoryIds.filter((id) => id !== territoryId),
  ];
}
