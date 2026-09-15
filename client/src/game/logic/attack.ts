import type { GameState } from '../../lib/types';
import type { SeaTerritory, Territory } from '../mapData';
import { withPortalEdges } from '../portals';

type OwnerById = Map<number, GameState['territories'][number]>;

function shipsAt(
  seas: GameState['seas'],
  seaTerritoryId: number,
  playerId: number | null,
): number {
  if (playerId === null) return 0;
  const sea = seas.find((s) => s.id === seaTerritoryId);
  return sea?.ships.find((b) => b.playerId === playerId)?.ships ?? 0;
}

function hasSeaBridgeTo(
  seaIds: Set<number>,
  seas: GameState['seas'],
  selfId: number | null,
  startTerritory: Territory,
  targetTerritory: Territory,
  targetOwnerId: number | undefined,
): boolean {
  const targetSeas = new Set(
    targetTerritory.neighbors.filter((n) => seaIds.has(n)),
  );
  return startTerritory.neighbors.some((seaId) => {
    if (!targetSeas.has(seaId)) return false;
    const attackerShips = shipsAt(seas, seaId, selfId);
    const defenderShips =
      targetOwnerId !== undefined ? shipsAt(seas, seaId, targetOwnerId) : 0;
    return attackerShips > 0 && attackerShips > defenderShips;
  });
}

function hasAnySeaBridgeFrom(
  territories: Territory[],
  seaIds: Set<number>,
  seas: GameState['seas'],
  selfId: number | null,
  startTerritory: Territory,
  ownerById: OwnerById,
  toxinById: Set<number>,
): boolean {
  const hasShipsNearby = startTerritory.neighbors.some(
    (n) => seaIds.has(n) && shipsAt(seas, n, selfId) > 0,
  );
  if (!hasShipsNearby) return false;
  return territories.some((t) => {
    if (t.id === startTerritory.id) return false;
    const ownerId = ownerById.get(t.id)?.ownerId;
    if (ownerId === selfId) return false;
    if (ownerId === undefined && toxinById.has(t.id)) return false;
    return hasSeaBridgeTo(seaIds, seas, selfId, startTerritory, t, ownerId);
  });
}

export function getAttackStartCandidates(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  seas: GameState['seas'],
  ownerById: OwnerById,
  selfId: number | null,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  toxinById: Set<number>,
): Set<number> {
  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const candidates = new Set<number>();
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId || owner.troops < 2) continue;
    const neighbors = withPortalEdges(
      t.neighbors,
      t.id,
      portalTerritoryIds,
      portalsEnabled,
    );
    const hasDirectTarget = neighbors.some((n) => {
      if (seaIds.has(n)) return false;
      const neighborOwner = ownerById.get(n);
      if (neighborOwner) return neighborOwner.ownerId !== selfId;
      return !toxinById.has(n);
    });
    if (
      hasDirectTarget ||
      hasAnySeaBridgeFrom(
        territories,
        seaIds,
        seas,
        selfId,
        t,
        ownerById,
        toxinById,
      )
    ) {
      candidates.add(t.id);
    }
  }
  return candidates;
}

export function getAttackPath(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  startId: number,
  endId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): number[] {
  const startTerritory = territories.find((t) => t.id === startId);
  const neighbors = withPortalEdges(
    startTerritory?.neighbors ?? [],
    startId,
    portalTerritoryIds,
    portalsEnabled,
  );
  if (neighbors.includes(endId)) return [startId, endId];
  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const endTerritory = territories.find((t) => t.id === endId);
  const endSeas = new Set(
    (endTerritory?.neighbors ?? []).filter((n) => seaIds.has(n)),
  );
  const seaId = (startTerritory?.neighbors ?? []).find(
    (n) => seaIds.has(n) && endSeas.has(n),
  );
  return seaId !== undefined ? [startId, seaId, endId] : [startId, endId];
}

export function getAttackEndCandidates(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  seas: GameState['seas'],
  ownerById: OwnerById,
  selfId: number | null,
  startId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  toxinById: Set<number>,
): Set<number> {
  const startTerritory = territories.find((t) => t.id === startId);
  if (!startTerritory) return new Set();
  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const neighbors = new Set(
    withPortalEdges(
      startTerritory.neighbors,
      startId,
      portalTerritoryIds,
      portalsEnabled,
    ),
  );
  const candidates = new Set<number>();
  for (const t of territories) {
    if (t.id === startId) continue;
    const owner = ownerById.get(t.id);
    if (owner?.ownerId === selfId) continue;
    if (!owner && toxinById.has(t.id)) continue;
    if (
      neighbors.has(t.id) ||
      hasSeaBridgeTo(seaIds, seas, selfId, startTerritory, t, owner?.ownerId)
    ) {
      candidates.add(t.id);
    }
  }
  return candidates;
}
