import { GridDimensions } from '../core/params';
import { GridPoint } from './placement';

export function computeTerritoryCentroids(
  labelGrid: Int16Array,
  territoryCount: number,
  dims: GridDimensions,
): GridPoint[] {
  const { width, height } = dims;
  const size = width * height;

  const sumX = new Float64Array(territoryCount);
  const sumY = new Float64Array(territoryCount);
  const count = new Int32Array(territoryCount);
  for (let i = 0; i < size; i++) {
    const id = labelGrid[i];
    if (id < 0) continue;
    sumX[id] += i % width;
    sumY[id] += (i / width) | 0;
    count[id]++;
  }

  const dist = distanceToOwnBorder(labelGrid, width, height, size);

  const bestDist = new Int32Array(territoryCount);
  const bestOffset = new Float64Array(territoryCount).fill(Infinity);
  const result: GridPoint[] = [];
  for (let id = 0; id < territoryCount; id++) result.push({ gx: 0, gy: 0 });

  for (let i = 0; i < size; i++) {
    const id = labelGrid[i];
    if (id < 0) continue;
    const d = dist[i];
    if (d < bestDist[id]) continue;
    const gx = i % width;
    const gy = (i / width) | 0;
    const n = count[id];
    const cx = n > 0 ? sumX[id] / n : gx;
    const cy = n > 0 ? sumY[id] / n : gy;
    const offset = (gx - cx) * (gx - cx) + (gy - cy) * (gy - cy);
    if (d > bestDist[id] || offset < bestOffset[id]) {
      bestDist[id] = d;
      bestOffset[id] = offset;
      result[id] = { gx, gy };
    }
  }

  return result;
}

function distanceToOwnBorder(
  labelGrid: Int16Array,
  width: number,
  height: number,
  size: number,
): Int32Array {
  const dist = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < size; i++) {
    const id = labelGrid[i];
    if (id < 0) continue;
    const gx = i % width;
    const gy = (i / width) | 0;
    const onEdge =
      gx === 0 || gy === 0 || gx === width - 1 || gy === height - 1;
    const touchesOther =
      (gx > 0 && labelGrid[i - 1] !== id) ||
      (gx < width - 1 && labelGrid[i + 1] !== id) ||
      (gy > 0 && labelGrid[i - width] !== id) ||
      (gy < height - 1 && labelGrid[i + width] !== id);
    if (onEdge || touchesOther) {
      dist[i] = 1;
      queue[tail++] = i;
    }
  }

  while (head < tail) {
    const i = queue[head++];
    const id = labelGrid[i];
    const next = dist[i] + 1;
    const gx = i % width;
    if (gx > 0 && labelGrid[i - 1] === id && dist[i - 1] === -1) {
      dist[i - 1] = next;
      queue[tail++] = i - 1;
    }
    if (gx < width - 1 && labelGrid[i + 1] === id && dist[i + 1] === -1) {
      dist[i + 1] = next;
      queue[tail++] = i + 1;
    }
    if (
      i - width >= 0 &&
      labelGrid[i - width] === id &&
      dist[i - width] === -1
    ) {
      dist[i - width] = next;
      queue[tail++] = i - width;
    }
    if (
      i + width < size &&
      labelGrid[i + width] === id &&
      dist[i + width] === -1
    ) {
      dist[i + width] = next;
      queue[tail++] = i + width;
    }
  }

  return dist;
}
