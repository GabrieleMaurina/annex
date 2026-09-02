import { randomInt, Rng } from '../core/rng';
import { GridPoint } from './placement';

const MIN_NEIGHBORS_FOR_MERGE = 4;

export function mergeTerritories(
  rng: Rng,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  centers: GridPoint[],
  mergeCount: number,
): { adjacency: Map<number, Set<number>>; centers: GridPoint[] } {
  const removed = new Set<number>();

  for (let m = 0; m < mergeCount; m++) {
    const candidates: number[] = [];
    for (let id = 0; id < centers.length; id++) {
      if (removed.has(id)) continue;
      if ((adjacency.get(id)?.size ?? 0) >= MIN_NEIGHBORS_FOR_MERGE) {
        candidates.push(id);
      }
    }
    if (candidates.length === 0) break;

    const target = candidates[randomInt(rng, 0, candidates.length - 1)];
    const targetNeighbors = [...adjacency.get(target)!];
    const absorbed =
      targetNeighbors[randomInt(rng, 0, targetNeighbors.length - 1)];

    for (let i = 0; i < labelGrid.length; i++) {
      if (labelGrid[i] === absorbed) labelGrid[i] = target;
    }

    for (const neighbor of adjacency.get(absorbed) ?? []) {
      if (neighbor === target) continue;
      adjacency.get(neighbor)?.delete(absorbed);
      adjacency.get(neighbor)?.add(target);
      adjacency.get(target)!.add(neighbor);
    }
    adjacency.get(target)!.delete(absorbed);
    adjacency.delete(absorbed);
    removed.add(absorbed);
  }

  if (removed.size === 0) return { adjacency, centers };

  const kept: number[] = [];
  for (let id = 0; id < centers.length; id++) {
    if (!removed.has(id)) kept.push(id);
  }
  const remap = new Map(kept.map((oldId, newId) => [oldId, newId]));

  for (let i = 0; i < labelGrid.length; i++) {
    if (labelGrid[i] >= 0) labelGrid[i] = remap.get(labelGrid[i])!;
  }

  const remappedAdjacency = new Map<number, Set<number>>();
  for (const oldId of kept) {
    const neighbors = new Set<number>();
    for (const neighbor of adjacency.get(oldId) ?? []) {
      const mapped = remap.get(neighbor);
      if (mapped !== undefined) neighbors.add(mapped);
    }
    remappedAdjacency.set(remap.get(oldId)!, neighbors);
  }

  return {
    adjacency: remappedAdjacency,
    centers: kept.map((oldId) => centers[oldId]),
  };
}
