import { getGameMap } from '../../maps/maps';
import { Game } from '../../types';
import { withPortalEdges } from './portals';

export function wouldSplitMap(
  game: Game,
  removedIds: Set<number>,
  candidateTerritoryId: number,
): boolean {
  const map = getGameMap(game);
  const removed = new Set(removedIds);
  removed.add(candidateTerritoryId);
  const remaining = map.territories.filter((t) => !removed.has(t.id));
  if (remaining.length === 0) return false;

  const remainingIds = new Set(remaining.map((t) => t.id));
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  const visited = new Set<number>([remaining[0].id]);
  const stack = [remaining[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const territory = territoryById.get(id)!;
    const neighbors = withPortalEdges(
      territory.neighbors,
      id,
      game.portalTerritoryIds,
      game.portalsEnabled,
    );
    for (const n of neighbors) {
      if (!remainingIds.has(n) || visited.has(n)) continue;
      visited.add(n);
      stack.push(n);
    }
  }
  return visited.size !== remaining.length;
}

export function ownedTerritoryClusters(
  game: Game,
  playerId: number,
): number[][] {
  const map = getGameMap(game);
  const neighborsById = new Map(
    map.territories.map((t) => [t.id, t.neighbors]),
  );
  const ownedIds: number[] = [];
  for (const [id, ownerId] of game.territoryOwners) {
    if (ownerId === playerId) ownedIds.push(id);
  }
  const ownedSet = new Set(ownedIds);
  const visited = new Set<number>();
  const clusters: number[][] = [];
  for (const start of ownedIds) {
    if (visited.has(start)) continue;
    const cluster: number[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);
      const neighbors = withPortalEdges(
        neighborsById.get(current) ?? [],
        current,
        game.portalTerritoryIds,
        game.portalsEnabled,
      );
      for (const neighborId of neighbors) {
        if (visited.has(neighborId) || !ownedSet.has(neighborId)) continue;
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function fortifyFullPath(
  game: Game,
  playerId: number,
  startId: number,
  endId: number,
): number[] {
  if (game.fortification === 'Unrestricted') return [startId, endId];
  const map = getGameMap(game);
  const territoryById = new Map(map.territories.map((t) => [t.id, t]));
  const visited = new Set<number>([startId]);
  const parentOf = new Map<number, number>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) break;
    const neighbors = withPortalEdges(
      territoryById.get(current)?.neighbors ?? [],
      current,
      game.portalTerritoryIds,
      game.portalsEnabled,
    );
    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) continue;
      if (game.territoryOwners.get(neighborId) !== playerId) continue;
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

export function connectedOwnedTerritories(
  game: Game,
  playerId: number,
  startIds: number[],
): Set<number> {
  const map = getGameMap(game);
  const neighborsById = new Map(
    map.territories.map((t) => [t.id, t.neighbors]),
  );
  const visited = new Set<number>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = withPortalEdges(
      neighborsById.get(current) ?? [],
      current,
      game.portalTerritoryIds,
      game.portalsEnabled,
    );
    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) continue;
      if (game.territoryOwners.get(neighborId) !== playerId) continue;
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }
  return visited;
}
