import type { GameState } from '../../lib/types';
import type { SeaTerritory } from '../mapData';

export function getSailStartCandidates(
  seaTerritories: SeaTerritory[],
  seas: GameState['seas'],
  selfId: number | null,
): Set<number> {
  const shipsBySeaId = new Map(seas.map((s) => [s.id, s.ships]));
  const candidates = new Set<number>();
  for (const s of seaTerritories) {
    const ships = shipsBySeaId.get(s.id) ?? [];
    if (ships.some((b) => b.playerId === selfId && b.ships > 0))
      candidates.add(s.id);
  }
  return candidates;
}

export function getSailEndCandidates(
  seaTerritories: SeaTerritory[],
  startId: number,
): Set<number> {
  const seaIds = new Set(seaTerritories.map((s) => s.id));
  const neighborsById = new Map(seaTerritories.map((s) => [s.id, s.neighbors]));
  const visited = new Set<number>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighborId of neighborsById.get(current) ?? []) {
      if (!seaIds.has(neighborId) || visited.has(neighborId)) continue;
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }
  visited.delete(startId);
  return visited;
}

export function getSailPath(
  seaTerritories: SeaTerritory[],
  startId: number,
  endId: number,
): number[] {
  const seaIds = new Set(seaTerritories.map((s) => s.id));
  const neighborsById = new Map(seaTerritories.map((s) => [s.id, s.neighbors]));
  const visited = new Set<number>([startId]);
  const parentOf = new Map<number, number>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) break;
    for (const neighborId of neighborsById.get(current) ?? []) {
      if (!seaIds.has(neighborId) || visited.has(neighborId)) continue;
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
