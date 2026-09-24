import { Perlin2D } from '../../core/noise';
import { GridDimensions } from '../../core/params';
import { Rng } from '../../core/rng';
import { computeTerritoryCentroids } from '../centroid';
import { enforceContiguity } from '../contiguity';
import { GridPoint } from '../placement';
import { findChokepointSplit } from './chokepoint';
import { hasUsefulPair, MAX_LAND_NEIGHBORS_PER_SEA } from './connectivity';
import {
  computeDistanceToLand,
  labelComponents,
  neighborsOfPixel,
  touchingLands,
} from './gridUtils';
import { mergeDownToCount } from './mergeUtil';
import {
  assignBalanced,
  pickSpreadPoints,
  splitOversizedRegions,
} from './regionAssign';
import { SeaWarp } from './warp';

const SEA_AREA_MULTIPLIER = 13;
const SMALL_LAKE_AREA_RATIO = 2;
const SMALL_SEA_MERGE_RATIO = 0.5;

export interface SeaBuild {
  seaLabelGrid: Int16Array;
  seaCount: number;
  seaCentroids: GridPoint[];
  seaAdjacency: Map<number, Set<number>>;
  landSeaAdjacency: Map<number, Set<number>>;
}

function partitionSeaBody(
  bodyPixels: number[],
  landLabelGrid: Int16Array,
  landComponentOf: Map<number, number>,
  width: number,
  height: number,
  expectedLandArea: number,
  seaLabelGrid: Int16Array,
  startId: number,
  warp: SeaWarp | null,
  maxLandNeighborsPerSea: number,
  targetCountOverride?: number,
): number {
  const touchingLandTerritories = new Set<number>();
  for (const i of bodyPixels) {
    for (const n of neighborsOfPixel(i, width, height)) {
      const landId = landLabelGrid[n];
      if (landId >= 0) touchingLandTerritories.add(landId);
    }
  }

  if (touchingLandTerritories.size <= 1) {
    for (const i of bodyPixels) seaLabelGrid[i] = startId;
    return startId + 1;
  }

  const touchingLandList = [...touchingLandTerritories];
  const landTerritoryIndex = new Map<number, number>(
    touchingLandList.map((landId, idx) => [landId, idx]),
  );
  const candidateCount = landTerritoryIndex.size;

  const candidateX = new Float64Array(candidateCount);
  const candidateY = new Float64Array(candidateCount);
  const candidateN = new Int32Array(candidateCount);
  for (const i of bodyPixels) {
    for (const n of neighborsOfPixel(i, width, height)) {
      const landId = landLabelGrid[n];
      if (landId < 0) continue;
      const idx = landTerritoryIndex.get(landId)!;
      candidateX[idx] += n % width;
      candidateY[idx] += (n / width) | 0;
      candidateN[idx]++;
    }
  }
  const candidates: GridPoint[] = [];
  for (let idx = 0; idx < candidateCount; idx++) {
    candidates.push({
      gx: candidateX[idx] / candidateN[idx],
      gy: candidateY[idx] / candidateN[idx],
    });
  }

  const expectedSeaArea = expectedLandArea * SEA_AREA_MULTIPLIER;
  const areaBasedTargetCount =
    targetCountOverride ??
    Math.max(1, Math.round(bodyPixels.length / expectedSeaArea));
  const capBasedTargetCount = Math.ceil(
    candidateCount / maxLandNeighborsPerSea,
  );
  const componentRepresentative = new Map<number, number>();
  for (let idx = 0; idx < touchingLandList.length; idx++) {
    const component = landComponentOf.get(touchingLandList[idx]);
    if (component === undefined) continue;
    if (!componentRepresentative.has(component)) {
      componentRepresentative.set(component, idx);
    }
  }
  const componentBasedTargetCount = componentRepresentative.size;
  const targetCount = Math.max(
    areaBasedTargetCount,
    capBasedTargetCount,
    componentBasedTargetCount,
  );
  const seedIndices = new Set([
    ...pickSpreadPoints(candidates, targetCount),
    ...componentRepresentative.values(),
  ]);
  const seeds = [...seedIndices].map((idx) => candidates[idx]);
  let regionCount = seeds.length;

  const regionOfPixel = assignBalanced(bodyPixels, seeds, warp, width, height);

  regionCount = splitOversizedRegions(
    regionOfPixel,
    bodyPixels,
    landLabelGrid,
    width,
    height,
    warp,
    regionCount,
    maxLandNeighborsPerSea,
    expectedSeaArea,
  );

  const regionSize = new Int32Array(regionCount);
  const regionLandNeighbors: Set<number>[] = Array.from(
    { length: regionCount },
    () => new Set<number>(),
  );
  const adjacency = new Map<number, Set<number>>();
  const borderLength = new Map<number, Map<number, number>>();
  for (let r = 0; r < regionCount; r++) {
    adjacency.set(r, new Set());
    borderLength.set(r, new Map());
  }
  const bump = (a: number, b: number) => {
    if (a === b) return;
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
    const ma = borderLength.get(a)!;
    ma.set(b, (ma.get(b) ?? 0) + 1);
    const mb = borderLength.get(b)!;
    mb.set(a, (mb.get(a) ?? 0) + 1);
  };
  for (const i of bodyPixels) {
    const region = regionOfPixel[i];
    regionSize[region]++;
    for (const n of neighborsOfPixel(i, width, height)) {
      const landId = landLabelGrid[n];
      if (landId >= 0) regionLandNeighbors[region].add(landId);
    }
    const x = i % width;
    if (x + 1 < width && regionOfPixel[i + 1] !== -1) {
      const b = regionOfPixel[i + 1];
      if (b !== region) bump(region, b);
    }
    if (i + width < width * height && regionOfPixel[i + width] !== -1) {
      const b = regionOfPixel[i + width];
      if (b !== region) bump(region, b);
    }
  }

  const remap =
    regionCount > targetCount
      ? mergeDownToCount(
          regionCount,
          adjacency,
          borderLength,
          regionSize,
          regionLandNeighbors,
          (liveCount) => liveCount > targetCount,
          maxLandNeighborsPerSea,
        )
      : new Map(Array.from({ length: regionCount }, (_, r) => [r, r]));

  const survivors = [...new Set(remap.values())];
  const compactIndex = new Map(survivors.map((id, idx) => [id, idx]));

  for (const i of bodyPixels) {
    const finalRegion = remap.get(regionOfPixel[i])!;
    seaLabelGrid[i] = startId + compactIndex.get(finalRegion)!;
  }

  return startId + survivors.length;
}

function computeLandComponents(
  landAdjacency: Map<number, Set<number>>,
): Map<number, number> {
  const componentOf = new Map<number, number>();
  let nextComponent = 0;
  for (const start of landAdjacency.keys()) {
    if (componentOf.has(start)) continue;
    componentOf.set(start, nextComponent);
    const stack = [start];
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const neighbor of landAdjacency.get(id) ?? []) {
        if (!componentOf.has(neighbor)) {
          componentOf.set(neighbor, nextComponent);
          stack.push(neighbor);
        }
      }
    }
    nextComponent++;
  }
  return componentOf;
}

function touchesMultipleLandmasses(
  lands: Set<number>,
  landComponentOf: Map<number, number>,
): boolean {
  let seen: number | undefined;
  for (const landId of lands) {
    const component = landComponentOf.get(landId);
    if (component === undefined) continue;
    if (seen === undefined) seen = component;
    else if (component !== seen) return true;
  }
  return false;
}

function partitionBodyRecursive(
  pixels: number[],
  landLabelGrid: Int16Array,
  landAdjacency: Map<number, Set<number>>,
  landComponentOf: Map<number, number>,
  width: number,
  height: number,
  expectedLandArea: number,
  typicalSize: number,
  distToLand: Int32Array,
  seaLabelGrid: Int16Array,
  startId: number,
  warp: SeaWarp | null,
  maxLandNeighborsPerSea: number,
): number {
  const targetCount = Math.max(1, Math.round(pixels.length / typicalSize));
  const lands = touchingLands(pixels, landLabelGrid, width, height);
  const landCount = lands.size;
  const spansMultipleLandmasses = touchesMultipleLandmasses(
    lands,
    landComponentOf,
  );

  if (
    targetCount > 1 ||
    landCount > maxLandNeighborsPerSea ||
    spansMultipleLandmasses
  ) {
    const minPieceSize = spansMultipleLandmasses
      ? Math.min(typicalSize, expectedLandArea) * SMALL_SEA_MERGE_RATIO
      : typicalSize * SMALL_SEA_MERGE_RATIO;
    const split = findChokepointSplit(
      pixels,
      distToLand,
      landLabelGrid,
      landAdjacency,
      width,
      height,
      minPieceSize,
    );
    if (split) {
      const nextId = partitionBodyRecursive(
        split[0],
        landLabelGrid,
        landAdjacency,
        landComponentOf,
        width,
        height,
        expectedLandArea,
        typicalSize,
        distToLand,
        seaLabelGrid,
        startId,
        warp,
        maxLandNeighborsPerSea,
      );
      return partitionBodyRecursive(
        split[1],
        landLabelGrid,
        landAdjacency,
        landComponentOf,
        width,
        height,
        expectedLandArea,
        typicalSize,
        distToLand,
        seaLabelGrid,
        nextId,
        warp,
        maxLandNeighborsPerSea,
      );
    }
  }

  return partitionSeaBody(
    pixels,
    landLabelGrid,
    landComponentOf,
    width,
    height,
    expectedLandArea,
    seaLabelGrid,
    startId,
    warp,
    maxLandNeighborsPerSea,
    targetCount,
  );
}

function mergeSmallSeaTerritories(
  seaCount: number,
  seaAdjacency: Map<number, Set<number>>,
  seaBorderLength: Map<number, Map<number, number>>,
  landSeaAdjacency: Map<number, Set<number>>,
  seaLabelGrid: Int16Array,
  smallSeaArea: number,
  maxLandNeighborsPerSea: number,
): {
  seaAdjacency: Map<number, Set<number>>;
  landSeaAdjacency: Map<number, Set<number>>;
  seaCount: number;
} {
  const seaLandAdjacency = new Map<number, Set<number>>();
  for (const [landId, seaIds] of landSeaAdjacency) {
    for (const seaId of seaIds) {
      const set = seaLandAdjacency.get(seaId) ?? new Set<number>();
      set.add(landId);
      seaLandAdjacency.set(seaId, set);
    }
  }

  const regionSize = new Int32Array(seaCount);
  for (let i = 0; i < seaLabelGrid.length; i++) {
    if (seaLabelGrid[i] >= 0) regionSize[seaLabelGrid[i]]++;
  }
  const regionLandNeighbors: Set<number>[] = Array.from(
    { length: seaCount },
    (_, id) => seaLandAdjacency.get(id) ?? new Set<number>(),
  );
  const adjacency = new Map<number, Set<number>>();
  const borderLength = new Map<number, Map<number, number>>();
  for (let id = 0; id < seaCount; id++) {
    adjacency.set(id, new Set(seaAdjacency.get(id) ?? []));
    borderLength.set(id, new Map(seaBorderLength.get(id) ?? []));
  }

  const remap = mergeDownToCount(
    seaCount,
    adjacency,
    borderLength,
    regionSize,
    regionLandNeighbors,
    (_liveCount, smallestSize) => smallestSize < smallSeaArea,
    maxLandNeighborsPerSea,
  );

  const survivors = [...adjacency.keys()].sort((a, b) => a - b);
  const compactIndex = new Map(survivors.map((id, idx) => [id, idx]));
  const finalOf = (id: number) => compactIndex.get(remap.get(id)!)!;

  for (let i = 0; i < seaLabelGrid.length; i++) {
    if (seaLabelGrid[i] >= 0) seaLabelGrid[i] = finalOf(seaLabelGrid[i]);
  }

  const newSeaAdjacency = new Map<number, Set<number>>();
  for (const id of survivors) {
    const neighbors = new Set<number>();
    for (const n of adjacency.get(id)!) neighbors.add(compactIndex.get(n)!);
    newSeaAdjacency.set(compactIndex.get(id)!, neighbors);
  }

  const newLandSeaAdjacency = new Map<number, Set<number>>();
  for (const [landId, seaIds] of landSeaAdjacency) {
    const mapped = new Set<number>();
    for (const w of seaIds) mapped.add(finalOf(w));
    newLandSeaAdjacency.set(landId, mapped);
  }

  return {
    seaAdjacency: newSeaAdjacency,
    landSeaAdjacency: newLandSeaAdjacency,
    seaCount: survivors.length,
  };
}

function pruneUselessSeaTerritories(
  seaCount: number,
  seaAdjacency: Map<number, Set<number>>,
  landSeaAdjacency: Map<number, Set<number>>,
  landAdjacency: Map<number, Set<number>>,
  landComponentOf: Map<number, number>,
  seaLabelGrid: Int16Array,
  maxLandNeighborsPerSea: number,
): {
  seaAdjacency: Map<number, Set<number>>;
  landSeaAdjacency: Map<number, Set<number>>;
  seaCount: number;
} {
  const seaLandAdjacency = new Map<number, Set<number>>();
  for (const [landId, seaIds] of landSeaAdjacency) {
    for (const seaId of seaIds) {
      const set = seaLandAdjacency.get(seaId) ?? new Set<number>();
      set.add(landId);
      seaLandAdjacency.set(seaId, set);
    }
  }

  const landsOf = (w: number): Set<number> =>
    seaLandAdjacency.get(w) ?? new Set<number>();
  const isUseful = (w: number): boolean =>
    hasUsefulPair([...landsOf(w)], landAdjacency);
  const spansLandmasses = (w: number): boolean =>
    touchesMultipleLandmasses(landsOf(w), landComponentOf);

  const alive = new Set<number>();
  for (let w = 0; w < seaCount; w++) alive.add(w);
  const rerouteTo = new Map<number, number>();

  let changed = true;
  while (changed) {
    changed = false;
    for (const w of [...alive]) {
      if (spansLandmasses(w)) continue;
      const useful = isUseful(w);

      const mergedLands = (n: number): Set<number> =>
        new Set([...landsOf(w), ...landsOf(n)]);
      const candidates = [...(seaAdjacency.get(w) ?? [])].filter(
        (n) => alive.has(n) && mergedLands(n).size <= maxLandNeighborsPerSea,
      );
      const bridging = candidates.filter((n) =>
        touchesMultipleLandmasses(mergedLands(n), landComponentOf),
      );
      const target =
        bridging.find((n) => !spansLandmasses(n)) ??
        bridging[0] ??
        (useful ? undefined : candidates[0]);
      if (useful && target === undefined) continue;
      if (target !== undefined) {
        for (const n of seaAdjacency.get(w) ?? []) {
          if (n === target) continue;
          seaAdjacency.get(n)?.delete(w);
          if (alive.has(n)) {
            seaAdjacency.get(n)!.add(target);
            seaAdjacency.get(target)!.add(n);
          }
        }
        seaAdjacency.get(target)?.delete(w);
        for (const landId of seaLandAdjacency.get(w) ?? []) {
          landSeaAdjacency.get(landId)?.delete(w);
          landSeaAdjacency.get(landId)?.add(target);
          const set = seaLandAdjacency.get(target) ?? new Set<number>();
          set.add(landId);
          seaLandAdjacency.set(target, set);
        }
        rerouteTo.set(w, target);
      } else {
        for (const landId of seaLandAdjacency.get(w) ?? []) {
          landSeaAdjacency.get(landId)?.delete(w);
        }
        rerouteTo.set(w, -1);
      }

      alive.delete(w);
      seaAdjacency.delete(w);
      seaLandAdjacency.delete(w);
      changed = true;
    }
  }

  const survivors = [...alive].sort((a, b) => a - b);
  const remap = new Map(survivors.map((id, idx) => [id, idx]));
  const resolvedCache = new Map<number, number>();
  const resolveFinal = (id: number): number => {
    if (resolvedCache.has(id)) return resolvedCache.get(id)!;
    let result = id;
    if (rerouteTo.has(id)) {
      const next = rerouteTo.get(id)!;
      result = next === -1 ? -1 : resolveFinal(next);
    }
    resolvedCache.set(id, result);
    return result;
  };
  for (let i = 0; i < seaLabelGrid.length; i++) {
    if (seaLabelGrid[i] < 0) continue;
    const resolved = resolveFinal(seaLabelGrid[i]);
    seaLabelGrid[i] = resolved === -1 ? -1 : remap.get(resolved)!;
  }

  const newSeaAdjacency = new Map<number, Set<number>>();
  for (const id of survivors) {
    const neighbors = new Set<number>();
    for (const n of seaAdjacency.get(id) ?? []) {
      const mapped = remap.get(n);
      if (mapped !== undefined) neighbors.add(mapped);
    }
    newSeaAdjacency.set(remap.get(id)!, neighbors);
  }

  const newLandSeaAdjacency = new Map<number, Set<number>>();
  for (const [landId, seaIds] of landSeaAdjacency) {
    const mapped = new Set<number>();
    for (const w of seaIds) {
      const m = remap.get(w);
      if (m !== undefined) mapped.add(m);
    }
    if (mapped.size > 0) newLandSeaAdjacency.set(landId, mapped);
  }

  return {
    seaAdjacency: newSeaAdjacency,
    landSeaAdjacency: newLandSeaAdjacency,
    seaCount: survivors.length,
  };
}

export function buildSeaTerritories(
  rng: Rng,
  landLabelGrid: Int16Array,
  width: number,
  height: number,
  dims: GridDimensions,
  expectedLandArea: number,
  landAdjacency: Map<number, Set<number>>,
  eligible?: Uint8Array,
  warped: boolean = true,
  seaAreaMultiplier: number = SEA_AREA_MULTIPLIER,
  maxLandNeighborsPerSea: number = MAX_LAND_NEIGHBORS_PER_SEA,
): SeaBuild {
  const size = width * height;
  const seaLabelGrid = new Int16Array(size).fill(-1);
  const warp: SeaWarp | null = warped
    ? { warpX: new Perlin2D(rng), warpY: new Perlin2D(rng) }
    : null;

  const bodyOfPixel = new Int32Array(size).fill(-1);
  const bodyCount = labelComponents(
    width,
    height,
    (i) => landLabelGrid[i] < 0 && (!eligible || eligible[i] === 1),
    bodyOfPixel,
  );

  if (bodyCount === 0) {
    return {
      seaLabelGrid,
      seaCount: 0,
      seaCentroids: [],
      seaAdjacency: new Map(),
      landSeaAdjacency: new Map(),
    };
  }

  const bodyPixels: number[][] = Array.from({ length: bodyCount }, () => []);
  for (let i = 0; i < size; i++) {
    if (bodyOfPixel[i] >= 0) bodyPixels[bodyOfPixel[i]].push(i);
  }

  const smallLakeArea = expectedLandArea * SMALL_LAKE_AREA_RATIO;
  const expectedSeaArea = expectedLandArea * seaAreaMultiplier;
  const eligibleBodies: number[] = [];
  for (let body = 0; body < bodyCount; body++) {
    if (bodyPixels[body].length < smallLakeArea) continue;
    eligibleBodies.push(body);
  }
  const impliedSizes = eligibleBodies.map((body) => {
    const rawCount = Math.max(
      1,
      Math.round(bodyPixels[body].length / expectedSeaArea),
    );
    return bodyPixels[body].length / rawCount;
  });
  const sortedImplied = [...impliedSizes].sort((a, b) => a - b);
  const typicalSize =
    sortedImplied.length > 0
      ? sortedImplied[Math.floor(sortedImplied.length / 2)]
      : expectedSeaArea;

  const distToLand = computeDistanceToLand(landLabelGrid, width, height);
  const landComponentOf = computeLandComponents(landAdjacency);
  let nextSeaId = 0;
  for (const body of eligibleBodies) {
    nextSeaId = partitionBodyRecursive(
      bodyPixels[body],
      landLabelGrid,
      landAdjacency,
      landComponentOf,
      width,
      height,
      expectedLandArea,
      typicalSize,
      distToLand,
      seaLabelGrid,
      nextSeaId,
      warp,
      maxLandNeighborsPerSea,
    );
  }

  enforceContiguity(seaLabelGrid, width, height);

  const allSeaPixels: number[] = [];
  for (let i = 0; i < size; i++) if (seaLabelGrid[i] >= 0) allSeaPixels.push(i);
  const globalRegionOfPixel = Int32Array.from(seaLabelGrid);
  const rawSeaCount = splitOversizedRegions(
    globalRegionOfPixel,
    allSeaPixels,
    landLabelGrid,
    width,
    height,
    warp,
    nextSeaId,
    maxLandNeighborsPerSea,
    expectedSeaArea,
  );
  seaLabelGrid.set(globalRegionOfPixel);
  enforceContiguity(seaLabelGrid, width, height);

  const landSeaAdjacency = new Map<number, Set<number>>();
  const seaAdjacency = new Map<number, Set<number>>();
  const seaBorderLength = new Map<number, Map<number, number>>();
  for (let w = 0; w < rawSeaCount; w++) {
    seaAdjacency.set(w, new Set());
    seaBorderLength.set(w, new Map());
  }
  const bumpLandSea = (landId: number, seaId: number) => {
    let set = landSeaAdjacency.get(landId);
    if (!set) landSeaAdjacency.set(landId, (set = new Set()));
    set.add(seaId);
  };
  const bumpSeaSea = (a: number, b: number) => {
    if (a === b) return;
    seaAdjacency.get(a)!.add(b);
    seaAdjacency.get(b)!.add(a);
    const ma = seaBorderLength.get(a)!;
    ma.set(b, (ma.get(b) ?? 0) + 1);
    const mb = seaBorderLength.get(b)!;
    mb.set(a, (mb.get(a) ?? 0) + 1);
  };
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const i = gy * width + gx;
      const landId = landLabelGrid[i];
      const seaId = seaLabelGrid[i];
      if (gx + 1 < width) {
        const rLand = landLabelGrid[i + 1];
        const rSea = seaLabelGrid[i + 1];
        if (landId >= 0 && rSea >= 0) bumpLandSea(landId, rSea);
        if (rLand >= 0 && seaId >= 0) bumpLandSea(rLand, seaId);
        if (seaId >= 0 && rSea >= 0) bumpSeaSea(seaId, rSea);
      }
      if (gy + 1 < height) {
        const dLand = landLabelGrid[i + width];
        const dSea = seaLabelGrid[i + width];
        if (landId >= 0 && dSea >= 0) bumpLandSea(landId, dSea);
        if (dLand >= 0 && seaId >= 0) bumpLandSea(dLand, seaId);
        if (seaId >= 0 && dSea >= 0) bumpSeaSea(seaId, dSea);
      }
    }
  }

  const merged = mergeSmallSeaTerritories(
    rawSeaCount,
    seaAdjacency,
    seaBorderLength,
    landSeaAdjacency,
    seaLabelGrid,
    expectedSeaArea * SMALL_SEA_MERGE_RATIO,
    maxLandNeighborsPerSea,
  );

  const pruned = pruneUselessSeaTerritories(
    merged.seaCount,
    merged.seaAdjacency,
    merged.landSeaAdjacency,
    landAdjacency,
    landComponentOf,
    seaLabelGrid,
    maxLandNeighborsPerSea,
  );

  const seaCentroids = computeTerritoryCentroids(
    seaLabelGrid,
    pruned.seaCount,
    dims,
  );

  return {
    seaLabelGrid,
    seaCount: pruned.seaCount,
    seaCentroids,
    seaAdjacency: pruned.seaAdjacency,
    landSeaAdjacency: pruned.landSeaAdjacency,
  };
}
