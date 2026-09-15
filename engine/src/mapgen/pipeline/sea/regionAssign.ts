import { GridPoint } from '../placement';
import { neighborsOfPixel } from './gridUtils';
import { SeaWarp, warpedPoint } from './warp';

export function pickSpreadPoints(points: GridPoint[], count: number): number[] {
  if (points.length <= count) return points.map((_, i) => i);
  const chosen = [0];
  const nearestDist = points.map(
    (p) => (p.gx - points[0].gx) ** 2 + (p.gy - points[0].gy) ** 2,
  );
  while (chosen.length < count) {
    let best = -1;
    let bestDist = -1;
    for (let i = 0; i < points.length; i++) {
      if (nearestDist[i] > bestDist) {
        bestDist = nearestDist[i];
        best = i;
      }
    }
    if (best === -1 || bestDist === 0) break;
    chosen.push(best);
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].gx - points[best].gx;
      const dy = points[i].gy - points[best].gy;
      const d = dx * dx + dy * dy;
      if (d < nearestDist[i]) nearestDist[i] = d;
    }
  }
  return chosen;
}

const BALANCE_ROUNDS = 30;
const BALANCE_DAMPING = 1;

export function assignBalanced(
  bodyPixels: number[],
  seeds: GridPoint[],
  warp: SeaWarp | null,
  width: number,
  height: number,
): Int32Array {
  const regionOfPixel = new Int32Array(width * height).fill(-1);
  const regionCount = seeds.length;
  const targetArea = bodyPixels.length / regionCount;
  const weight = new Float64Array(regionCount);
  const seedX = new Float64Array(regionCount);
  const seedY = new Float64Array(regionCount);
  for (let s = 0; s < regionCount; s++) {
    seedX[s] = seeds[s].gx;
    seedY[s] = seeds[s].gy;
  }

  const warpedX = new Float64Array(bodyPixels.length);
  const warpedY = new Float64Array(bodyPixels.length);
  for (let idx = 0; idx < bodyPixels.length; idx++) {
    const i = bodyPixels[idx];
    const warped = warpedPoint(warp, i % width, (i / width) | 0);
    warpedX[idx] = warped.gx;
    warpedY[idx] = warped.gy;
  }

  for (let round = 0; round < BALANCE_ROUNDS; round++) {
    const areas = new Int32Array(regionCount);
    for (let idx = 0; idx < bodyPixels.length; idx++) {
      const i = bodyPixels[idx];
      const wx = warpedX[idx];
      const wy = warpedY[idx];
      let best = 0;
      let bestDist = Infinity;
      for (let s = 0; s < regionCount; s++) {
        const dx = seedX[s] - wx;
        const dy = seedY[s] - wy;
        const d = dx * dx + dy * dy - weight[s];
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      regionOfPixel[i] = best;
      areas[best]++;
    }
    if (round === BALANCE_ROUNDS - 1) break;
    const roundDamping = BALANCE_DAMPING / (1 + round * 0.5);
    for (let s = 0; s < regionCount; s++) {
      weight[s] += (targetArea - areas[s]) * roundDamping;
    }
  }

  return regionOfPixel;
}

const MAX_SPLIT_ROUNDS = 5;
const OVERSIZED_AREA_RATIO = 2;

export function splitOversizedRegions(
  regionOfPixel: Int32Array,
  bodyPixels: number[],
  landLabelGrid: Int16Array,
  width: number,
  height: number,
  warp: SeaWarp | null,
  regionCount: number,
  maxLandNeighbors: number,
  expectedRegionArea: number,
): number {
  for (let round = 0; round < MAX_SPLIT_ROUNDS; round++) {
    const pixelsByRegion = new Map<number, number[]>();
    for (const i of bodyPixels) {
      const list = pixelsByRegion.get(regionOfPixel[i]) ?? [];
      list.push(i);
      pixelsByRegion.set(regionOfPixel[i], list);
    }
    const landsByRegion = new Map<number, Set<number>>();
    for (const [region, pixels] of pixelsByRegion) {
      const lands = new Set<number>();
      for (const i of pixels) {
        for (const n of neighborsOfPixel(i, width, height)) {
          const landId = landLabelGrid[n];
          if (landId >= 0) lands.add(landId);
        }
      }
      landsByRegion.set(region, lands);
    }

    let anySplit = false;
    for (const [region, lands] of landsByRegion) {
      const pixels = pixelsByRegion.get(region)!;
      const overLandCap = lands.size > maxLandNeighbors;
      const overArea =
        expectedRegionArea > 0 &&
        pixels.length > expectedRegionArea * OVERSIZED_AREA_RATIO;
      if (!overLandCap && !overArea) continue;
      anySplit = true;

      if (!overLandCap) {
        const groupCount = Math.max(
          2,
          Math.round(pixels.length / expectedRegionArea),
        );
        const seedIndices = pickSpreadPoints(
          pixels.map((i) => ({ gx: i % width, gy: (i / width) | 0 })),
          groupCount,
        );
        const seeds: GridPoint[] = seedIndices.map((idx) => ({
          gx: pixels[idx] % width,
          gy: (pixels[idx] / width) | 0,
        }));
        const subRegionIds = seeds.map((_, k) =>
          k === 0 ? region : regionCount++,
        );
        const subRegionOfPixel = assignBalanced(
          pixels,
          seeds,
          warp,
          width,
          height,
        );
        for (const i of pixels) {
          regionOfPixel[i] = subRegionIds[subRegionOfPixel[i]];
        }
        continue;
      }

      const landIds = [...lands];
      const landIndex = new Map(landIds.map((id, i) => [id, i]));
      const seedX = new Float64Array(landIds.length);
      const seedY = new Float64Array(landIds.length);
      const seedN = new Int32Array(landIds.length);
      for (const i of pixels) {
        for (const n of neighborsOfPixel(i, width, height)) {
          const landId = landLabelGrid[n];
          if (landId < 0) continue;
          const k = landIndex.get(landId)!;
          seedX[k] += n % width;
          seedY[k] += (n / width) | 0;
          seedN[k]++;
        }
      }
      const landGroupCount = Math.ceil(landIds.length / maxLandNeighbors);
      const areaGroupCount =
        expectedRegionArea > 0
          ? Math.max(1, Math.round(pixels.length / expectedRegionArea))
          : 1;
      const groupCount = Math.min(
        landIds.length,
        Math.max(landGroupCount, areaGroupCount),
      );
      let regionCx = 0;
      let regionCy = 0;
      for (const i of pixels) {
        regionCx += i % width;
        regionCy += (i / width) | 0;
      }
      regionCx /= pixels.length;
      regionCy /= pixels.length;
      const order = landIds
        .map((_, k) => k)
        .sort(
          (a, b) =>
            Math.atan2(
              seedY[a] / seedN[a] - regionCy,
              seedX[a] / seedN[a] - regionCx,
            ) -
            Math.atan2(
              seedY[b] / seedN[b] - regionCy,
              seedX[b] / seedN[b] - regionCx,
            ),
        );
      const totalWeight = seedN.reduce((a, b) => a + b, 0);
      const targetPerGroup = totalWeight / groupCount;
      const groupOfLand = new Int32Array(landIds.length);
      let acc = 0;
      let g = 0;
      for (const k of order) {
        groupOfLand[k] = g;
        acc += seedN[k];
        if (acc >= targetPerGroup * (g + 1) && g < groupCount - 1) g++;
      }
      const groupX = new Float64Array(groupCount);
      const groupY = new Float64Array(groupCount);
      const groupN = new Int32Array(groupCount);
      for (let k = 0; k < landIds.length; k++) {
        const group = groupOfLand[k];
        groupX[group] += seedX[k];
        groupY[group] += seedY[k];
        groupN[group] += seedN[k];
      }
      const seeds: GridPoint[] = Array.from({ length: groupCount }, (_, s) => ({
        gx: groupX[s] / groupN[s],
        gy: groupY[s] / groupN[s],
      }));
      const subRegionIds = seeds.map((_, k) =>
        k === 0 ? region : regionCount++,
      );
      const subRegionOfPixel = assignBalanced(
        pixels,
        seeds,
        warp,
        width,
        height,
      );
      for (const i of pixels) {
        regionOfPixel[i] = subRegionIds[subRegionOfPixel[i]];
      }
    }
    if (!anySplit) break;
  }
  return regionCount;
}
