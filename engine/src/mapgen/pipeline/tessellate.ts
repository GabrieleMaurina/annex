import { Rng } from '../core/rng';
import { createWarpField, warpAt, WarpField } from '../core/warp';
import { enforceContiguity } from './contiguity';
import { GridPoint } from './placement';

const MIN_LAKE_AREA_RATIO = 0.4;

export interface Tessellation {
  labelGrid: Int16Array;
  adjacency: Map<number, Set<number>>;
  borderLength: Map<number, Map<number, number>>;
  centers: GridPoint[];
}

export function tessellate(
  rng: Rng,
  land: Uint8Array,
  width: number,
  height: number,
  centers: GridPoint[],
  expectedTerritoryArea: number,
): Tessellation {
  const field = createWarpField(rng, width, height);
  const labelGrid = new Int16Array(width * height).fill(-1);

  if (centers.length > 0)
    assignWarpedVoronoi(land, width, height, centers, field, labelGrid);

  enforceContiguity(labelGrid, width, height);
  fillSmallLakes(
    labelGrid,
    width,
    height,
    expectedTerritoryArea * MIN_LAKE_AREA_RATIO,
  );

  const liveCenters = dropEmptyTerritories(labelGrid, centers);
  const { adjacency, borderLength } = buildAdjacency(labelGrid, width, height);
  return { labelGrid, adjacency, borderLength, centers: liveCenters };
}

function assignWarpedVoronoi(
  land: Uint8Array,
  width: number,
  height: number,
  centers: GridPoint[],
  field: WarpField,
  labelGrid: Int16Array,
): void {
  const n = centers.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = centers[i].gx;
    ys[i] = centers[i].gy;
  }

  const cell = Math.max(32, Math.round(Math.sqrt((width * height) / n) * 0.9));
  const bcols = Math.max(1, Math.ceil(width / cell));
  const brows = Math.max(1, Math.ceil(height / cell));
  const buckets: number[][] = [];
  for (let i = 0; i < bcols * brows; i++) buckets.push([]);
  for (let i = 0; i < n; i++) {
    const bx = Math.min(bcols - 1, (xs[i] / cell) | 0);
    const by = Math.min(brows - 1, (ys[i] / cell) | 0);
    buckets[by * bcols + bx].push(i);
  }

  const nearest = (wx: number, wy: number): number => {
    const qbx = Math.max(0, Math.min(bcols - 1, (wx / cell) | 0));
    const qby = Math.max(0, Math.min(brows - 1, (wy / cell) | 0));
    let bestId = 0;
    let bestD = Infinity;
    for (let ring = 0; ; ring++) {
      const x0 = qbx - ring;
      const x1 = qbx + ring;
      const y0 = qby - ring;
      const y1 = qby + ring;
      for (let by = y0; by <= y1; by++) {
        if (by < 0 || by >= brows) continue;
        const edgeRow = by === y0 || by === y1;
        for (let bx = x0; bx <= x1; bx++) {
          if (bx < 0 || bx >= bcols) continue;
          if (!edgeRow && bx !== x0 && bx !== x1) continue;
          const bucket = buckets[by * bcols + bx];
          for (let k = 0; k < bucket.length; k++) {
            const i = bucket[k];
            const dx = xs[i] - wx;
            const dy = ys[i] - wy;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              bestId = i;
            }
          }
        }
      }
      const safe = ring * cell;
      if (bestD !== Infinity && safe * safe >= bestD) break;
      if (x0 < 0 && x1 >= bcols && y0 < 0 && y1 >= brows) break;
    }
    return bestId;
  };

  const warped = { x: 0, y: 0 };
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (!land[gy * width + gx]) continue;
      warpAt(field, gx, gy, warped);
      labelGrid[gy * width + gx] = nearest(warped.x, warped.y);
    }
  }
}

function fillSmallLakes(
  labelGrid: Int16Array,
  width: number,
  height: number,
  minArea: number,
): void {
  const size = width * height;
  const visited = new Uint8Array(size);
  const stack = new Int32Array(size);
  const neighbors = [0, 0, 0, 0];
  for (let start = 0; start < size; start++) {
    if (labelGrid[start] !== -1 || visited[start]) continue;
    let sp = 0;
    let touchesEdge = false;
    const cells: number[] = [];
    const borderLabels = new Map<number, number>();
    stack[sp++] = start;
    visited[start] = 1;
    while (sp > 0) {
      const c = stack[--sp];
      cells.push(c);
      const x = c % width;
      const y = (c / width) | 0;
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1)
        touchesEdge = true;
      neighbors[0] = x > 0 ? c - 1 : -1;
      neighbors[1] = x < width - 1 ? c + 1 : -1;
      neighbors[2] = y > 0 ? c - width : -1;
      neighbors[3] = y < height - 1 ? c + width : -1;
      for (let d = 0; d < 4; d++) {
        const nc = neighbors[d];
        if (nc < 0) continue;
        const nl = labelGrid[nc];
        if (nl === -1) {
          if (!visited[nc]) {
            visited[nc] = 1;
            stack[sp++] = nc;
          }
        } else {
          borderLabels.set(nl, (borderLabels.get(nl) ?? 0) + 1);
        }
      }
    }
    if (touchesEdge || cells.length >= minArea || borderLabels.size === 0)
      continue;
    let fill = -1;
    let best = -1;
    for (const [label, n] of borderLabels) {
      if (n > best) {
        best = n;
        fill = label;
      }
    }
    for (const c of cells) labelGrid[c] = fill;
  }
}

function dropEmptyTerritories(
  labelGrid: Int16Array,
  centers: GridPoint[],
): GridPoint[] {
  const counts = new Int32Array(centers.length);
  for (let i = 0; i < labelGrid.length; i++) {
    const id = labelGrid[i];
    if (id >= 0) counts[id]++;
  }
  const kept: number[] = [];
  for (let i = 0; i < centers.length; i++) if (counts[i] > 0) kept.push(i);
  if (kept.length === centers.length) return centers;

  const remap = new Int32Array(centers.length).fill(-1);
  kept.forEach((oldId, newId) => {
    remap[oldId] = newId;
  });
  for (let i = 0; i < labelGrid.length; i++) {
    if (labelGrid[i] >= 0) labelGrid[i] = remap[labelGrid[i]];
  }
  return kept.map((oldId) => centers[oldId]);
}

function buildAdjacency(
  labelGrid: Int16Array,
  width: number,
  height: number,
): {
  adjacency: Map<number, Set<number>>;
  borderLength: Map<number, Map<number, number>>;
} {
  const adjacency = new Map<number, Set<number>>();
  const borderLength = new Map<number, Map<number, number>>();
  const bump = (a: number, b: number) => {
    if (a === b) return;
    let na = adjacency.get(a);
    if (!na) adjacency.set(a, (na = new Set()));
    let nb = adjacency.get(b);
    if (!nb) adjacency.set(b, (nb = new Set()));
    na.add(b);
    nb.add(a);
    let la = borderLength.get(a);
    if (!la) borderLength.set(a, (la = new Map()));
    let lb = borderLength.get(b);
    if (!lb) borderLength.set(b, (lb = new Map()));
    la.set(b, (la.get(b) ?? 0) + 1);
    lb.set(a, (lb.get(a) ?? 0) + 1);
  };
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const id = labelGrid[gy * width + gx];
      if (id < 0) continue;
      if (gx + 1 < width) {
        const r = labelGrid[gy * width + gx + 1];
        if (r >= 0 && r !== id) bump(id, r);
      }
      if (gy + 1 < height) {
        const d = labelGrid[(gy + 1) * width + gx];
        if (d >= 0 && d !== id) bump(id, d);
      }
    }
  }
  return { adjacency, borderLength };
}
