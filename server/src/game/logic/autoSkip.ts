import { maps } from '../../maps';
import { Game } from '../../types';

function ownedTerritoryIds(game: Game, playerId: number): number[] {
  return [...game.territoryOwners.entries()]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([territoryId]) => territoryId);
}

export function hasAnyAttack(game: Game, playerId: number): boolean {
  const map = maps.get(game.mapName)!;
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  return ownedTerritoryIds(game, playerId).some((id) => {
    if ((game.territoryTroops.get(id) ?? 0) < 2) return false;
    return (
      territoryById.get(id)?.neighbors.some((n) => {
        const ownerId = game.territoryOwners.get(n);
        return ownerId !== undefined && ownerId !== playerId;
      }) ?? false
    );
  });
}

export function hasAnyFortify(game: Game, playerId: number): boolean {
  const map = maps.get(game.mapName)!;
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  return ownedTerritoryIds(game, playerId).some((id) => {
    if ((game.territoryTroops.get(id) ?? 0) < 2) return false;
    return (
      territoryById
        .get(id)
        ?.neighbors.some((n) => game.territoryOwners.get(n) === playerId) ??
      false
    );
  });
}
