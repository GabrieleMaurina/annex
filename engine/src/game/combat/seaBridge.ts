import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { isFreeConquestTarget } from '../toxins/toxins';
import { withPortalEdges } from '../world/portals';

function shipsAt(game: Game, seaTerritoryId: number, playerId: number): number {
  return game.seaShips.get(seaTerritoryId)?.get(playerId) ?? 0;
}

function qualifyingBridgeSeaId(
  game: Game,
  playerId: number,
  startId: number,
  targetId: number,
  targetOwnerId: number | undefined,
): number | undefined {
  const map = getGameMap(game);
  const startTerritory = map.territories.find((t) => t.id === startId);
  const targetTerritory = map.territories.find((t) => t.id === targetId);
  if (!startTerritory || !targetTerritory) return undefined;
  const seaIds = new Set(map.seaTerritories.map((t) => t.id));
  const targetSeas = new Set(
    targetTerritory.neighbors.filter((n) => seaIds.has(n)),
  );
  return startTerritory.neighbors.find((seaId) => {
    if (!targetSeas.has(seaId)) return false;
    const attackerShips = shipsAt(game, seaId, playerId);
    const defenderShips =
      targetOwnerId !== undefined ? shipsAt(game, seaId, targetOwnerId) : 0;
    return attackerShips > defenderShips;
  });
}

export function hasSeaBridgeTo(
  game: Game,
  playerId: number,
  startId: number,
  targetId: number,
  targetOwnerId: number | undefined,
): boolean {
  return (
    qualifyingBridgeSeaId(game, playerId, startId, targetId, targetOwnerId) !==
    undefined
  );
}

export function attackFullPath(
  game: Game,
  playerId: number,
  startId: number,
  endId: number,
): number[] {
  const map = getGameMap(game);
  const territory = map.territories.find((t) => t.id === startId);
  const neighbors = withPortalEdges(
    territory?.neighbors ?? [],
    startId,
    game.portalTerritoryIds,
    game.portalsEnabled,
  );
  if (neighbors.includes(endId)) return [startId, endId];
  const ownerId = game.territoryOwners.get(endId);
  const targetOwnerId = ownerId === playerId ? undefined : ownerId;
  const seaId = qualifyingBridgeSeaId(
    game,
    playerId,
    startId,
    endId,
    targetOwnerId,
  );
  return seaId !== undefined ? [startId, seaId, endId] : [startId, endId];
}

export function hasAnySeaBridgeFrom(
  game: Game,
  playerId: number,
  startId: number,
): boolean {
  const map = getGameMap(game);
  const startTerritory = map.territories.find((t) => t.id === startId);
  if (!startTerritory) return false;
  const seaIds = new Set(map.seaTerritories.map((t) => t.id));
  const hasShipsNearby = startTerritory.neighbors.some(
    (n) => seaIds.has(n) && shipsAt(game, n, playerId) > 0,
  );
  if (!hasShipsNearby) return false;
  return map.territories.some((t) => {
    if (t.id === startId) return false;
    const ownerId = game.territoryOwners.get(t.id);
    if (ownerId === playerId) return false;
    if (ownerId === undefined && !isFreeConquestTarget(game, t.id))
      return false;
    return hasSeaBridgeTo(game, playerId, startId, t.id, ownerId);
  });
}
