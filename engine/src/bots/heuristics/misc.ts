import { supplyHubTerritoryIds } from '../../game/mechanics';
import { connectedOwnedTerritories } from '../../game/world/connectivity';
import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import {
  isFrontier,
  neighborsOf,
  ownedTerritoryIds,
} from '../features/territory';
import { Weights } from '../types';
import { BotView } from '../view';

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
  const reachable = connectedOwnedTerritories(
    game,
    botId,
    supplyHubTerritoryIds(game, botId),
  );
  const connected = owned.filter((id) => reachable.has(id));
  if (connected.length === 0) return null;
  return connected[Math.floor(Math.random() * connected.length)];
}

export function chooseCapital(game: Game, botId: number): number | null {
  const owned = ownedTerritoryIds(game, botId);
  if (owned.length === 0) return null;
  return owned.reduce((best, id) => {
    const ownedNeighbors = neighborsOf(game, id).filter(
      (n) => game.territoryOwners.get(n) === botId,
    ).length;
    const bestNeighbors = neighborsOf(game, best).filter(
      (n) => game.territoryOwners.get(n) === botId,
    ).length;
    return ownedNeighbors > bestNeighbors ? id : best;
  }, owned[0]);
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
  const troops = Math.floor((game.territoryTroops.get(territoryId) ?? 0) / 2);
  return troops >= 1 ? { territoryId, troops } : null;
}
