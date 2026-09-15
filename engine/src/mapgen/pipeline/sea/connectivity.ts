import { addEdge, findComponents, SpecialEdge } from '../connectivity';
import { GridPoint } from '../placement';

export function pseudoEdgesFromSeaNeighbors(
  landSeaAdjacency: Map<number, Set<number>>,
): SpecialEdge[] {
  const seaToLand = new Map<number, number[]>();
  for (const [landId, seaIds] of landSeaAdjacency) {
    for (const seaId of seaIds) {
      const list = seaToLand.get(seaId) ?? [];
      list.push(landId);
      seaToLand.set(seaId, list);
    }
  }
  const edges: SpecialEdge[] = [];
  for (const landIds of seaToLand.values()) {
    for (let i = 0; i < landIds.length; i++) {
      for (let j = i + 1; j < landIds.length; j++) {
        edges.push({ a: landIds[i], b: landIds[j] });
      }
    }
  }
  return edges;
}

export const MAX_LAND_NEIGHBORS_PER_SEA = 12;

export function hasUsefulPair(
  lands: number[],
  landAdjacency: Map<number, Set<number>>,
): boolean {
  for (let i = 0; i < lands.length; i++) {
    for (let j = i + 1; j < lands.length; j++) {
      if (!landAdjacency.get(lands[i])?.has(lands[j])) return true;
    }
  }
  return false;
}

export function ensureSeaUsefulness(
  doors: Map<number, Set<number>>,
  rawLandSeaAdjacency: Map<number, Set<number>>,
  landAdjacency: Map<number, Set<number>>,
): void {
  const seaLands = new Map<number, Set<number>>();
  for (const [landId, seaIds] of rawLandSeaAdjacency) {
    for (const seaId of seaIds) {
      const set = seaLands.get(seaId) ?? new Set<number>();
      set.add(landId);
      seaLands.set(seaId, set);
    }
  }

  for (const [seaId, rawLands] of seaLands) {
    const openLands = [...rawLands].filter((landId) =>
      doors.get(landId)?.has(seaId),
    );
    if (hasUsefulPair(openLands, landAdjacency)) continue;

    const rawList = [...rawLands];
    let pair: [number, number] | null = null;
    for (let i = 0; i < rawList.length && !pair; i++) {
      for (let j = i + 1; j < rawList.length; j++) {
        if (!landAdjacency.get(rawList[i])?.has(rawList[j])) {
          pair = [rawList[i], rawList[j]];
          break;
        }
      }
    }
    if (!pair) continue;

    for (const landId of pair) {
      const set = doors.get(landId) ?? new Set<number>();
      set.add(seaId);
      doors.set(landId, set);
    }
  }
}

export function ensureGraphConnected(
  centroids: GridPoint[],
  adjacency: Map<number, Set<number>>,
  forbidPair: (a: number, b: number) => boolean,
): void {
  const count = centroids.length;
  if (count <= 1) return;

  let componentOf = findComponents(count, adjacency);
  let componentCount = new Set(componentOf).size;

  while (componentCount > 1) {
    let restricted: { a: number; b: number; dist: number } | null = null;
    let any: { a: number; b: number; dist: number } | null = null;
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        if (componentOf[a] === componentOf[b]) continue;
        const dist = Math.hypot(
          centroids[a].gx - centroids[b].gx,
          centroids[a].gy - centroids[b].gy,
        );
        if (!any || dist < any.dist) any = { a, b, dist };
        if (forbidPair(a, b)) continue;
        if (!restricted || dist < restricted.dist) restricted = { a, b, dist };
      }
    }
    const picked = restricted ?? any;
    if (!picked) break;
    addEdge(adjacency, picked.a, picked.b);
    componentOf = findComponents(count, adjacency);
    componentCount = new Set(componentOf).size;
  }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function openSharedSeaDoor(
  a: number,
  b: number,
  rawLandSeaAdjacency: Map<number, Set<number>>,
  doors: Map<number, Set<number>>,
): void {
  const aSeas = rawLandSeaAdjacency.get(a);
  const bSeas = rawLandSeaAdjacency.get(b);
  if (!aSeas || !bSeas) return;
  let sharedSea = -1;
  for (const seaId of aSeas) {
    if (bSeas.has(seaId)) {
      sharedSea = seaId;
      break;
    }
  }
  if (sharedSea === -1) return;
  for (const landId of [a, b]) {
    const set = doors.get(landId) ?? new Set<number>();
    set.add(sharedSea);
    doors.set(landId, set);
  }
}

export function ensureSingleSeaHopReachability(
  landCentroids: GridPoint[],
  landAdjacency: Map<number, Set<number>>,
  doors: Map<number, Set<number>>,
  rawLandSeaAdjacency: Map<number, Set<number>>,
): SpecialEdge[] {
  const reduced = new Map<number, Set<number>>();
  for (const [id, neighbors] of landAdjacency)
    reduced.set(id, new Set(neighbors));

  const pseudo = pseudoEdgesFromSeaNeighbors(doors);
  const pseudoKeys = new Set(pseudo.map(({ a, b }) => pairKey(a, b)));
  for (const { a, b } of pseudo) addEdge(reduced, a, b);

  const rawPseudoKeys = new Set(
    pseudoEdgesFromSeaNeighbors(rawLandSeaAdjacency).map(({ a, b }) =>
      pairKey(a, b),
    ),
  );

  ensureGraphConnected(
    landCentroids,
    reduced,
    (a, b) => !rawPseudoKeys.has(pairKey(a, b)),
  );

  const bridgeEdges: SpecialEdge[] = [];
  for (const [id, neighbors] of reduced) {
    for (const neighbor of neighbors) {
      if (id >= neighbor) continue;
      if (landAdjacency.get(id)?.has(neighbor)) continue;
      if (pseudoKeys.has(pairKey(id, neighbor))) continue;
      if (rawPseudoKeys.has(pairKey(id, neighbor))) {
        openSharedSeaDoor(id, neighbor, rawLandSeaAdjacency, doors);
        continue;
      }
      addEdge(landAdjacency, id, neighbor);
      bridgeEdges.push({ a: id, b: neighbor });
    }
  }
  return bridgeEdges;
}
