import { getGameMap } from '../../maps/maps';
import { Game, LockedTile } from '../../types';
import { nextSetBaseValues } from '../progression/cards';

export function unlockCost(game: Game, playerId: number): number {
  if (game.cards === 'constant' || game.cards === 'off') return 5;
  return Math.ceil(nextSetBaseValues(game, playerId).mixed * 0.25);
}

export function closedTiles(game: Game): LockedTile[] {
  return getGameMap(game).lockedTiles.filter(
    (tile) => !game.unlockedTileIds.has(tile.id),
  );
}

export function lockedTilesNextTo(
  game: Game,
  territoryId: number,
): LockedTile[] {
  return closedTiles(game).filter((tile) =>
    tile.neighbors.includes(territoryId),
  );
}

export function canUnlockFrom(
  game: Game,
  playerId: number,
  territoryId: number,
): boolean {
  return (
    game.territoryOwners.get(territoryId) === playerId &&
    (game.territoryTroops.get(territoryId) ?? 0) >=
      unlockCost(game, playerId) + 1 &&
    lockedTilesNextTo(game, territoryId).length > 0
  );
}
