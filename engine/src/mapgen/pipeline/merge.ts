import { Rng } from '../core/rng';
import { GridPoint } from './placement';

const MIN_NEIGHBORS_FOR_MERGE = 4;

type Graph = {
  adjacency: Map<number, Set<number>>;
  borderLength: Map<number, Map<number, number>>;
};

function weightedPick(rng: Rng, items: number[], weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let threshold = rng() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold < 0) return items[i];
  }
  return items[items.length - 1];
}

export function mergeTerritories(
  rng: Rng,
  labelGrid: Int16Array,
  graph: Graph,
  centers: GridPoint[],
  mergeCount: number,
): { adjacency: Map<number, Set<number>>; centers: GridPoint[] } {
  const { adjacency, borderLength } = graph;
  const removed = new Set<number>();

  for (let m = 0; m < mergeCount; m++) {
    const candidates: number[] = [];
    for (let id = 0; id < centers.length; id++) {
      if (removed.has(id)) continue;
      if ((adjacency.get(id)?.size ?? 0) >= MIN_NEIGHBORS_FOR_MERGE)
        candidates.push(id);
    }
    if (candidates.length === 0) break;

    const target = candidates[Math.floor(rng() * candidates.length)];
    const neighbors = [...adjacency.get(target)!];
    const weights = neighbors.map((n) => borderLength.get(target)?.get(n) ?? 1);
    const absorbed = weightedPick(rng, neighbors, weights);

    for (let i = 0; i < labelGrid.length; i++) {
      if (labelGrid[i] === absorbed) labelGrid[i] = target;
    }

    for (const neighbor of adjacency.get(absorbed) ?? []) {
      if (neighbor === target) continue;
      adjacency.get(neighbor)?.delete(absorbed);
      adjacency.get(neighbor)?.add(target);
      adjacency.get(target)!.add(neighbor);
      const shared = borderLength.get(absorbed)?.get(neighbor) ?? 0;
      const t = borderLength.get(target)!;
      t.set(neighbor, (t.get(neighbor) ?? 0) + shared);
      const nb = borderLength.get(neighbor)!;
      nb.set(target, (nb.get(target) ?? 0) + shared);
      nb.delete(absorbed);
    }
    adjacency.get(target)!.delete(absorbed);
    adjacency.delete(absorbed);
    borderLength.get(target)!.delete(absorbed);
    borderLength.delete(absorbed);
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

  const newAdjacency = new Map<number, Set<number>>();
  for (const oldId of kept) {
    const neighbors = new Set<number>();
    for (const neighbor of adjacency.get(oldId) ?? []) {
      const mapped = remap.get(neighbor);
      if (mapped !== undefined) neighbors.add(mapped);
    }
    newAdjacency.set(remap.get(oldId)!, neighbors);
  }

  return {
    adjacency: newAdjacency,
    centers: kept.map((oldId) => centers[oldId]),
  };
}
