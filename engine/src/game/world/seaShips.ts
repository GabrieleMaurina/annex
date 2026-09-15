import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';

export function isSeaTerritory(game: Game, id: number): boolean {
  return getGameMap(game).seaTerritories.some((t) => t.id === id);
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
