export function mergeDownToCount(
  regionCount: number,
  adjacency: Map<number, Set<number>>,
  borderLength: Map<number, Map<number, number>>,
  regionSize: Int32Array,
  regionLandNeighbors: Set<number>[],
  shouldMerge: (liveCount: number, smallestSize: number) => boolean,
  maxLandNeighbors: number,
): Map<number, number> {
  const size = new Map<number, number>();
  for (let r = 0; r < regionCount; r++) size.set(r, regionSize[r]);
  const landNeighbors = new Map<number, Set<number>>();
  for (let r = 0; r < regionCount; r++)
    landNeighbors.set(r, regionLandNeighbors[r]);
  const remap = new Map<number, number>();
  for (let r = 0; r < regionCount; r++) remap.set(r, r);

  const locked = new Set<number>();
  let liveCount = regionCount;
  while (true) {
    let smallest = -1;
    let smallestSize = Infinity;
    for (const [id, s] of size) {
      if (locked.has(id)) continue;
      if ((adjacency.get(id)?.size ?? 0) === 0) continue;
      if (s < smallestSize) {
        smallestSize = s;
        smallest = id;
      }
    }
    if (smallest === -1 || !shouldMerge(liveCount, smallestSize)) break;

    let target = -1;
    let bestBorder = -1;
    for (const n of adjacency.get(smallest)!) {
      const combined = new Set([
        ...landNeighbors.get(smallest)!,
        ...landNeighbors.get(n)!,
      ]);
      if (combined.size > maxLandNeighbors) continue;
      const border = borderLength.get(smallest)?.get(n) ?? 0;
      if (border > bestBorder) {
        bestBorder = border;
        target = n;
      }
    }
    if (target === -1) {
      locked.add(smallest);
      continue;
    }

    const absorbed = smallest;
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
    borderLength.get(target)?.delete(absorbed);
    borderLength.delete(absorbed);
    size.set(target, (size.get(target) ?? 0) + (size.get(absorbed) ?? 0));
    size.delete(absorbed);
    landNeighbors.set(
      target,
      new Set([...landNeighbors.get(target)!, ...landNeighbors.get(absorbed)!]),
    );
    landNeighbors.delete(absorbed);

    for (const [orig, cur] of remap)
      if (cur === absorbed) remap.set(orig, target);
    liveCount--;
  }

  return remap;
}
