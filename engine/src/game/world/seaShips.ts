import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';

export const SHIP_COST = 3;

export function isSeaTerritory(game: Game, id: number): boolean {
  return getGameMap(game).seaTerritories.some((t) => t.id === id);
}

export function canBuyShipsFromTerritory(
  game: Game,
  playerId: number,
): boolean {
  const map = getGameMap(game);
  const seaIds = new Set(map.seaTerritories.map((t) => t.id));
  return map.territories.some(
    (t) =>
      game.territoryOwners.get(t.id) === playerId &&
      (game.territoryTroops.get(t.id) ?? 0) >= SHIP_COST + 1 &&
      t.neighbors.some((n) => seaIds.has(n)),
  );
}

export function setSeaShips(
  game: Game,
  seaTerritoryId: number,
  playerId: number,
  ships: number,
): void {
  const shipsByPlayer = game.seaShips.get(seaTerritoryId);
  if (!shipsByPlayer) return;
  if (ships <= 0) shipsByPlayer.delete(playerId);
  else shipsByPlayer.set(playerId, ships);
  if (shipsByPlayer.size === 0) game.seaShips.delete(seaTerritoryId);
}

export function addSeaShips(
  game: Game,
  seaTerritoryId: number,
  playerId: number,
  ships: number,
): void {
  const shipsByPlayer = game.seaShips.get(seaTerritoryId) ?? new Map();
  shipsByPlayer.set(playerId, (shipsByPlayer.get(playerId) ?? 0) + ships);
  game.seaShips.set(seaTerritoryId, shipsByPlayer);
}
