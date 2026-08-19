import type { Territory } from './mapData';
import type { GameState } from '../lib/types';

type OwnerById = Map<number, GameState['territories'][number]>;

export function getFortifyStartCandidates(
  territories: Territory[],
  ownerById: OwnerById,
  selfId: number | null,
): Set<number> {
  const candidates = new Set<number>();
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId || owner.troops < 2) continue;
    if (t.neighbors.some((n) => ownerById.get(n)?.ownerId === selfId)) {
      candidates.add(t.id);
    }
  }
  return candidates;
}

export function getFortifyEndCandidates(
  territories: Territory[],
  ownerById: OwnerById,
  selfId: number | null,
  startId: number,
): Set<number> {
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const visited = new Set<number>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighborId of territoryById.get(current)?.neighbors ?? []) {
      if (visited.has(neighborId)) continue;
      if (ownerById.get(neighborId)?.ownerId !== selfId) continue;
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }
  visited.delete(startId);
  return visited;
}

export function getFortifyPath(
  territories: Territory[],
  ownerById: OwnerById,
  ownerId: number | null,
  startId: number,
  endId: number,
): number[] {
  const territoryById = new Map(territories.map((t) => [t.id, t]));
  const visited = new Set<number>([startId]);
  const parentOf = new Map<number, number>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) break;
    for (const neighborId of territoryById.get(current)?.neighbors ?? []) {
      if (visited.has(neighborId)) continue;
      if (ownerById.get(neighborId)?.ownerId !== ownerId) continue;
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
