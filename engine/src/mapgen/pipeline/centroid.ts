import { GridDimensions } from '../core/params';
import { GridPoint } from './placement';

export function computeTerritoryCentroids(
  labelGrid: Int16Array,
  territoryCount: number,
  dims: GridDimensions,
): GridPoint[] {
  const { width, height } = dims;
  const sumX = new Array(territoryCount).fill(0);
  const sumY = new Array(territoryCount).fill(0);
  const count = new Array(territoryCount).fill(0);

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const id = labelGrid[gy * width + gx];
      if (id < 0) continue;
      sumX[id] += gx;
      sumY[id] += gy;
      count[id]++;
    }
  }

  const rawCentroid: GridPoint[] = [];
  for (let i = 0; i < territoryCount; i++) {
    rawCentroid.push(
      count[i] > 0
        ? { gx: sumX[i] / count[i], gy: sumY[i] / count[i] }
        : { gx: 0, gy: 0 },
    );
  }

  const bestDist = new Array(territoryCount).fill(Infinity);
  const snapped: GridPoint[] = rawCentroid.map((p) => ({ ...p }));

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const id = labelGrid[gy * width + gx];
      if (id < 0) continue;
      const dist = Math.hypot(gx - rawCentroid[id].gx, gy - rawCentroid[id].gy);
      if (dist < bestDist[id]) {
        bestDist[id] = dist;
        snapped[id] = { gx, gy };
      }
    }
  }

  return snapped;
}
