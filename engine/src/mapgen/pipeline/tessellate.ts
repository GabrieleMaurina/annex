import { Perlin2D } from '../core/noise';
import { Rng } from '../core/rng';
import { enforceContiguity } from './contiguity';
import { GridPoint } from './placement';
import { smoothBorders } from './smoothing';

const WARP_FREQUENCY_1 = 0.035;
const WARP_AMPLITUDE_1 = 9;
const WARP_FREQUENCY_2 = 0.12;
const WARP_AMPLITUDE_2 = 3.5;

const MIN_LAKE_AREA_RATIO = 0.4;

function fillSmallLakes(
  labelGrid: Int16Array,
  width: number,
  height: number,
  minArea: number,
): void {
  const visited = new Uint8Array(width * height);
  for (let start = 0; start < labelGrid.length; start++) {
    if (labelGrid[start] !== -1 || visited[start]) continue;

    const cells: number[] = [];
    const borderLabels = new Map<number, number>();
    let touchesEdge = false;
    const stack = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const cell = stack.pop()!;
      cells.push(cell);
      const cx = cell % width;
      const cy = Math.floor(cell / width);
      if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1)
        touchesEdge = true;
      const neighbors: [number, number][] = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        const nLabel = labelGrid[nIdx];
        if (nLabel === -1) {
          if (!visited[nIdx]) {
            visited[nIdx] = 1;
            stack.push(nIdx);
          }
        } else if (nLabel >= 0) {
          borderLabels.set(nLabel, (borderLabels.get(nLabel) ?? 0) + 1);
        }
      }
    }

    if (touchesEdge || cells.length >= minArea || borderLabels.size === 0)
      continue;

    let fillLabel = -1;
    let bestCount = -1;
    for (const [label, count] of borderLabels) {
      if (count > bestCount) {
        bestCount = count;
        fillLabel = label;
      }
    }
    for (const cell of cells) labelGrid[cell] = fillLabel;
  }
}

export interface Tessellation {
  labelGrid: Int16Array;
  adjacency: Map<number, Set<number>>;
  centers: GridPoint[];
}

export function tessellate(
  rng: Rng,
  land: boolean[][],
  centers: GridPoint[],
  expectedTerritoryArea: number,
): Tessellation {
  const height = land.length;
  const width = land[0]?.length ?? 0;
  const warpX = new Perlin2D(rng);
  const warpY = new Perlin2D(rng);
  const labelGrid = new Int16Array(width * height).fill(-1);

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (!land[gy][gx] || centers.length === 0) continue;
      const wx =
        gx +
        warpX.noise(gx * WARP_FREQUENCY_1, gy * WARP_FREQUENCY_1) *
          WARP_AMPLITUDE_1 +
        warpX.noise(gx * WARP_FREQUENCY_2, gy * WARP_FREQUENCY_2) *
          WARP_AMPLITUDE_2;
      const wy =
        gy +
        warpY.noise(gx * WARP_FREQUENCY_1, gy * WARP_FREQUENCY_1) *
          WARP_AMPLITUDE_1 +
        warpY.noise(gx * WARP_FREQUENCY_2, gy * WARP_FREQUENCY_2) *
          WARP_AMPLITUDE_2;

      let bestId = 0;
      let bestDist = Infinity;
      for (let i = 0; i < centers.length; i++) {
        const dist = Math.hypot(centers[i].gx - wx, centers[i].gy - wy);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = i;
        }
      }
      labelGrid[gy * width + gx] = bestId;
    }
  }

  smoothBorders(labelGrid, width, height);
  enforceContiguity(land, labelGrid, centers.length);
  fillSmallLakes(
    labelGrid,
    width,
    height,
    expectedTerritoryArea * MIN_LAKE_AREA_RATIO,
  );

  const cellCounts = new Array(centers.length).fill(0);
  for (const id of labelGrid) if (id >= 0) cellCounts[id]++;
  const keptOldIds = centers.map((_, i) => i).filter((i) => cellCounts[i] > 0);
  if (keptOldIds.length !== centers.length) {
    const remap = new Map(keptOldIds.map((oldId, newId) => [oldId, newId]));
    for (let i = 0; i < labelGrid.length; i++) {
      if (labelGrid[i] >= 0) labelGrid[i] = remap.get(labelGrid[i])!;
    }
    centers = keptOldIds.map((oldId) => centers[oldId]);
  }

  const adjacency = new Map<number, Set<number>>();
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const id = labelGrid[gy * width + gx];
      if (id < 0) continue;
      const rightId = gx + 1 < width ? labelGrid[gy * width + gx + 1] : -1;
      const downId = gy + 1 < height ? labelGrid[(gy + 1) * width + gx] : -1;
      if (rightId >= 0 && rightId !== id) addEdge(id, rightId);
      if (downId >= 0 && downId !== id) addEdge(id, downId);
    }
  }

  return { labelGrid, adjacency, centers };
}
