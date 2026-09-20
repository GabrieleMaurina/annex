import { supplyHubTerritoryIds } from '../../game/mechanics';
import { connectedFortifyTerritories } from '../../game/world/connectivity';
import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import {
  isFrontier,
  neighborsOf,
  ownedTerritoryIds,
} from '../features/territory';
import { Weights } from '../types';
import { BotView } from '../view';

const MAX_ENTRENCH_TROOPS = 5;

export function chooseTerritoryClaim(game: Game): number | null {
  const map = getGameMap(game);
  const unclaimed = map.territories
    .map((t) => t.id)
    .filter(
      (id) =>
        !game.territoryOwners.has(id) && !game.radiationTerritoryIds.has(id),
    );
  if (unclaimed.length === 0) return null;
  return unclaimed[Math.floor(Math.random() * unclaimed.length)];
}

export function chooseTroopPlacement(game: Game, botId: number): number | null {
  const owned = ownedTerritoryIds(game, botId);
  if (owned.length === 0) return null;
  if (game.supplyLines !== 'on')
    return owned[Math.floor(Math.random() * owned.length)];
  const reachable = connectedFortifyTerritories(
    game,
    botId,
    supplyHubTerritoryIds(game, botId),
  );
  const connected = owned.filter((id) => reachable.has(id));
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)];
}

const OWNED_NEIGHBOR_VALUE = 1;
const FOREIGN_NEIGHBOR_COST = 1.5;
const TROOP_VALUE = 0.2;

function capitalValue(game: Game, botId: number, territoryId: number): number {
  let value = (game.territoryTroops.get(territoryId) ?? 0) * TROOP_VALUE;
  for (const n of neighborsOf(game, territoryId))
    value +=
      game.territoryOwners.get(n) === botId
        ? OWNED_NEIGHBOR_VALUE
        : -FOREIGN_NEIGHBOR_COST;
  return value;
}

export function chooseCapital(game: Game, botId: number): number | null {
  const owned = ownedTerritoryIds(game, botId);
  if (owned.length === 0) return null;
  return owned.reduce((best, id) =>
    capitalValue(game, botId, id) > capitalValue(game, botId, best) ? id : best,
  );
}

export function chooseEntrench(
  game: Game,
  view: BotView,
  botId: number,
  weights: Weights,
): { territoryId: number; troops: number } | null {
  if (weights.defendFrontier < 1) return null;
  const owned = ownedTerritoryIds(game, botId).filter(
    (id) =>
      !game.capitalTerritoryIds.has(id) &&
      (game.territoryTroops.get(id) ?? 0) >= 3 &&
      isFrontier(game, view, botId, id),
  );
  if (owned.length === 0) return null;
  const territoryId = owned[0];
  const troops = Math.min(
    MAX_ENTRENCH_TROOPS,
    Math.floor((game.territoryTroops.get(territoryId) ?? 0) / 2),
  );
  return troops >= 1 ? { territoryId, troops } : null;
}
