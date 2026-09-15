import type { Fortification, GameState } from '../../lib/types';
import type { SeaTerritory, Territory } from '../mapData';
import { withPortalEdges } from '../portals';

type OwnerById = Map<number, GameState['territories'][number]>;

function hasOwnShips(
  seas: GameState['seas'],
  seaTerritoryId: number,
  playerId: number | null,
): boolean {
  if (playerId === null) return false;
  const sea = seas.find((s) => s.id === seaTerritoryId);
  return (sea?.ships.find((b) => b.playerId === playerId)?.ships ?? 0) > 0;
}

function fortifyGraphNeighbors(
  neighborsById: Map<number, number[]>,
  seaIds: Set<number>,
  currentId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): number[] {
  if (seaIds.has(currentId)) return neighborsById.get(currentId) ?? [];
  return withPortalEdges(
    neighborsById.get(currentId) ?? [],
    currentId,
    portalTerritoryIds,
    portalsEnabled,
  );
}

function canEnterFortifyNode(
  seaIds: Set<number>,
  seas: GameState['seas'],
  ownerById: OwnerById,
  playerId: number | null,
  nodeId: number,
): boolean {
  if (seaIds.has(nodeId)) return hasOwnShips(seas, nodeId, playerId);
  return ownerById.get(nodeId)?.ownerId === playerId;
}

function connectedFortifyReachable(
  neighborsById: Map<number, number[]>,
  seaIds: Set<number>,
  seas: GameState['seas'],
  ownerById: OwnerById,
  selfId: number | null,
  startId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): Set<number> {
  const visited = new Set<number>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighborId of fortifyGraphNeighbors(
      neighborsById,
      seaIds,
      current,
      portalTerritoryIds,
      portalsEnabled,
    )) {
      if (visited.has(neighborId)) continue;
      if (!canEnterFortifyNode(seaIds, seas, ownerById, selfId, neighborId))
        continue;
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }
  return visited;
}

export function getFortifyStartCandidates(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  seas: GameState['seas'],
  ownerById: OwnerById,
  selfId: number | null,
  fortification: Fortification,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): Set<number> {
  const ownedCount = territories.filter(
    (t) => ownerById.get(t.id)?.ownerId === selfId,
  ).length;
  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const neighborsById = new Map(
    [...territories, ...seaTerritories].map((t) => [t.id, t.neighbors]),
  );
  const candidates = new Set<number>();
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId || owner.troops < 2) continue;
    if (fortification === 'Unrestricted') {
      if (ownedCount > 1) candidates.add(t.id);
    } else if (fortification === 'Connected') {
      const reachable = connectedFortifyReachable(
        neighborsById,
        seaIds,
        seas,
        ownerById,
        selfId,
        t.id,
        portalTerritoryIds,
        portalsEnabled,
      );
      const hasDestination = [...reachable].some(
        (id) => id !== t.id && !seaIds.has(id),
      );
      if (hasDestination) candidates.add(t.id);
    } else {
      const neighbors = withPortalEdges(
        t.neighbors,
        t.id,
        portalTerritoryIds,
        portalsEnabled,
      );
      if (neighbors.some((n) => ownerById.get(n)?.ownerId === selfId)) {
        candidates.add(t.id);
      }
    }
  }
  return candidates;
}

export function getFortifyEndCandidates(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  seas: GameState['seas'],
  ownerById: OwnerById,
  selfId: number | null,
  startId: number,
  fortification: Fortification,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): Set<number> {
  if (fortification === 'Unrestricted') {
    return new Set(
      territories
        .filter(
          (t) => t.id !== startId && ownerById.get(t.id)?.ownerId === selfId,
        )
        .map((t) => t.id),
    );
  }
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  if (fortification === 'Neighboring') {
    const neighbors = withPortalEdges(
      territoryById.get(startId)?.neighbors ?? [],
      startId,
      portalTerritoryIds,
      portalsEnabled,
    );
    return new Set(
      neighbors.filter((n) => ownerById.get(n)?.ownerId === selfId),
    );
  }
  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const neighborsById = new Map(
    [...territories, ...seaTerritories].map((t) => [t.id, t.neighbors]),
  );
  const reachable = connectedFortifyReachable(
    neighborsById,
    seaIds,
    seas,
    ownerById,
    selfId,
    startId,
    portalTerritoryIds,
    portalsEnabled,
  );
  reachable.delete(startId);
  for (const id of seaIds) reachable.delete(id);
  return reachable;
}

export function getFortifyPath(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  seas: GameState['seas'],
  ownerById: OwnerById,
  ownerId: number | null,
  startId: number,
  endId: number,
  fortification: Fortification,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
): number[] {
  if (fortification === 'Unrestricted') return [startId, endId];
  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const neighborsById = new Map(
    [...territories, ...seaTerritories].map((t) => [t.id, t.neighbors]),
  );
  const visited = new Set<number>([startId]);
  const parentOf = new Map<number, number>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) break;
    for (const neighborId of fortifyGraphNeighbors(
      neighborsById,
      seaIds,
      current,
      portalTerritoryIds,
      portalsEnabled,
    )) {
      if (visited.has(neighborId)) continue;
      if (!canEnterFortifyNode(seaIds, seas, ownerById, ownerId, neighborId))
        continue;
      visited.add(neighborId);
      parentOf.set(neighborId, current);
      queue.push(neighborId);
    }
  }
  if (!visited.has(endId)) return [];

  const path = [endId];
  let node = endId;
  while (node !== startId) {
    const parent = parentOf.get(node);
    if (parent === undefined) return [];
    path.push(parent);
    node = parent;
  }
  return path.reverse();
}
