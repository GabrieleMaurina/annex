import { Fill, GridDimensions, MapSize } from '../../core/params';
import { randomInt, Rng } from '../../core/rng';
import {
  continentTempleTone,
  TEMPLE_SEAM_COLOR,
  TEMPLE_VOID_COLOR,
  TEMPLE_WALL_COLOR,
} from '../../render/palette';
import { CellLayer } from './cellLayer';
import { buildMazeMap, MazeMap } from './mazeMap';

const RING_RANGES: Record<MapSize, [number, number]> = {
  small: [7, 9],
  medium: [10, 12],
  large: [12, 14],
  xlarge: [14, 16],
};
const BASE_SECTORS = 5;
const MAX_ARC_ASPECT = 2.2;
const MAX_RADIUS_FRACTION = 0.47;
const RING_JITTER = 0.32;
const DEAD_END_BRAID_CHANCE = 0.55;

const VOID_FRACTION: Record<Fill, number> = {
  full: 0.04,
  mixed: 0.12,
  sparse: 0.26,
};

interface PolarGrid {
  nRings: number;
  sectors: number[];
  ringOffset: number[];
  ringRadii: number[];
  cellCount: number;
  potential: number[][];
  open: Set<number>;
  navigable: Uint8Array;
}

function pairKey(a: number, b: number): number {
  return a < b ? a * 1e7 + b : b * 1e7 + a;
}

function buildPolarGrid(rng: Rng, nRings: number): PolarGrid {
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < nRings; i++) {
    const w = 1 + (rng() * 2 - 1) * RING_JITTER;
    weights.push(w);
    weightSum += w;
  }
  const ringRadii = [0];
  let acc = 0;
  for (let i = 0; i < nRings; i++) {
    acc += weights[i];
    ringRadii.push(acc / weightSum);
  }
  ringRadii[nRings] = 1;

  const sectors: number[] = [];
  const ringOffset: number[] = [];
  let cellCount = 0;
  for (let i = 0; i < nRings; i++) {
    let count: number;
    if (i === 0) count = 1;
    else if (i === 1) count = BASE_SECTORS;
    else {
      const previous = sectors[i - 1];
      const mid = (ringRadii[i] + ringRadii[i + 1]) / 2;
      const thickness = ringRadii[i + 1] - ringRadii[i];
      const arcAspect = (2 * Math.PI * mid) / (previous * thickness);
      count = arcAspect > MAX_ARC_ASPECT ? previous * 2 : previous;
    }
    sectors.push(count);
    ringOffset.push(cellCount);
    cellCount += count;
  }

  const potential: number[][] = Array.from({ length: cellCount }, () => []);
  const link = (a: number, b: number) => {
    potential[a].push(b);
    potential[b].push(a);
  };
  for (let i = 0; i < nRings; i++) {
    const count = sectors[i];
    for (let s = 0; s < count; s++) {
      const id = ringOffset[i] + s;
      if (count > 1) link(id, ringOffset[i] + ((s + 1) % count));
      if (i + 1 < nRings) {
        const outer = sectors[i + 1];
        const from = Math.floor((s * outer) / count);
        const to = Math.ceil(((s + 1) * outer) / count);
        for (let os = from; os < to; os++) {
          link(id, ringOffset[i + 1] + (os % outer));
        }
      }
    }
  }
  for (let id = 0; id < cellCount; id++) {
    potential[id] = [...new Set(potential[id])];
  }

  return {
    nRings,
    sectors,
    ringOffset,
    ringRadii,
    cellCount,
    potential,
    open: new Set(),
    navigable: new Uint8Array(cellCount).fill(1),
  };
}

function carveMaze(rng: Rng, grid: PolarGrid): void {
  const visited = new Uint8Array(grid.cellCount);
  const stack = [0];
  visited[0] = 1;
  while (stack.length > 0) {
    const cell = stack[stack.length - 1];
    const candidates = grid.potential[cell].filter((n) => !visited[n]);
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[randomInt(rng, 0, candidates.length - 1)];
    grid.open.add(pairKey(cell, next));
    visited[next] = 1;
    stack.push(next);
  }
}

function addChambers(rng: Rng, grid: PolarGrid, count: number): number[][] {
  const clusters: number[][] = [];
  for (let c = 0; c < count; c++) {
    const r0 = randomInt(rng, 1, Math.max(1, grid.nRings - 3));
    const dr = Math.min(grid.nRings - r0, rng() < 0.4 ? 2 : 1);
    const baseCount = grid.sectors[r0];
    const ds = Math.min(
      Math.max(1, Math.floor(baseCount / 2)),
      rng() < 0.45 ? 2 : 1,
    );
    const s0 = randomInt(rng, 0, baseCount - 1);

    const cells = new Set<number>();
    for (let r = r0; r < r0 + dr; r++) {
      const cnt = grid.sectors[r];
      const ratio = cnt / baseCount;
      for (let k = 0; k < ds * ratio; k++) {
        const s = (Math.floor(s0 * ratio) + k) % cnt;
        cells.add(grid.ringOffset[r] + s);
      }
    }
    for (const a of cells) {
      for (const b of grid.potential[a]) {
        if (cells.has(b)) grid.open.add(pairKey(a, b));
      }
    }
    if (cells.size >= 2) clusters.push([...cells]);
  }
  return clusters;
}

function fillHoles(grid: PolarGrid): void {
  for (let cell = 0; cell < grid.cellCount; cell++) {
    if (grid.navigable[cell]) continue;
    const neighbors = grid.potential[cell];
    if (neighbors.length === 0) continue;
    const openNeighbors = neighbors.filter((n) => grid.navigable[n]);
    if (openNeighbors.length < neighbors.length) continue;
    grid.navigable[cell] = 1;
    for (const n of openNeighbors) grid.open.add(pairKey(cell, n));
  }
}

function braid(rng: Rng, grid: PolarGrid): void {
  for (let cell = 0; cell < grid.cellCount; cell++) {
    if (!grid.navigable[cell]) continue;
    const open = grid.potential[cell].filter((n) =>
      grid.open.has(pairKey(cell, n)),
    );
    if (open.length !== 1) continue;
    if (rng() >= DEAD_END_BRAID_CHANCE) continue;
    const closed = grid.potential[cell].filter(
      (n) => grid.navigable[n] && !grid.open.has(pairKey(cell, n)),
    );
    if (closed.length === 0) continue;
    const pick = closed[randomInt(rng, 0, closed.length - 1)];
    grid.open.add(pairKey(cell, pick));
  }
}

function carveVoid(rng: Rng, grid: PolarGrid, fraction: number): void {
  let target = Math.floor(grid.cellCount * fraction);
  let guard = 0;
  while (target > 0 && guard++ < grid.cellCount) {
    const seed = randomInt(rng, 0, grid.cellCount - 1);
    if (!grid.navigable[seed]) continue;
    const blob = randomInt(rng, 2, 5);
    const queue = [seed];
    let head = 0;
    let removed = 0;
    while (head < queue.length && target > 0 && removed < blob) {
      const cell = queue[head++];
      if (!grid.navigable[cell]) continue;
      grid.navigable[cell] = 0;
      target--;
      removed++;
      for (const n of grid.potential[cell]) {
        if (grid.navigable[n] && rng() < 0.5) queue.push(n);
      }
    }
  }
  for (let cell = 0; cell < grid.cellCount; cell++) {
    if (!grid.navigable[cell]) continue;
    const hasLink = grid.potential[cell].some((n) =>
      grid.open.has(pairKey(cell, n)),
    );
    if (!hasLink) grid.navigable[cell] = 0;
  }
}

function reconnect(grid: PolarGrid): void {
  const componentOf = new Int32Array(grid.cellCount).fill(-1);
  const components: number[][] = [];
  for (let start = 0; start < grid.cellCount; start++) {
    if (!grid.navigable[start] || componentOf[start] !== -1) continue;
    const id = components.length;
    const stack = [start];
    componentOf[start] = id;
    const members = [start];
    while (stack.length > 0) {
      const cell = stack.pop()!;
      for (const n of grid.potential[cell]) {
        if (
          grid.navigable[n] &&
          componentOf[n] === -1 &&
          grid.open.has(pairKey(cell, n))
        ) {
          componentOf[n] = id;
          stack.push(n);
          members.push(n);
        }
      }
    }
    components.push(members);
  }
  if (components.length <= 1) return;

  components.sort((a, b) => b.length - a.length);
  const joined = new Set(components[0]);
  for (let k = 1; k < components.length; k++) {
    let bridged = false;
    for (const cell of components[k]) {
      for (const n of grid.potential[cell]) {
        if (grid.navigable[n] && joined.has(n)) {
          grid.open.add(pairKey(cell, n));
          bridged = true;
          break;
        }
      }
      if (bridged) break;
    }
    if (bridged) for (const cell of components[k]) joined.add(cell);
  }
}

function ringOf(grid: PolarGrid, radiusFraction: number): number {
  for (let i = 1; i < grid.ringRadii.length; i++) {
    if (radiusFraction < grid.ringRadii[i]) return i - 1;
  }
  return grid.nRings - 1;
}

function toCellLayer(
  grid: PolarGrid,
  dims: GridDimensions,
  clusters: number[][],
): CellLayer {
  const { width, height } = dims;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = MAX_RADIUS_FRACTION * Math.min(width, height);

  const cellNeighbors: number[][] = Array.from(
    { length: grid.cellCount },
    (_, cell) =>
      grid.potential[cell].filter(
        (n) =>
          grid.navigable[cell] &&
          grid.navigable[n] &&
          grid.open.has(pairKey(cell, n)),
      ),
  );

  const pixelCell = new Int32Array(width * height).fill(-1);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const radius = Math.hypot(dx, dy);
      if (radius >= maxRadius) continue;
      const ring = ringOf(grid, radius / maxRadius);
      const count = grid.sectors[ring];
      let angle = Math.atan2(dy, dx) / (2 * Math.PI);
      if (angle < 0) angle += 1;
      const sector = Math.min(count - 1, Math.floor(angle * count));
      const cell = grid.ringOffset[ring] + sector;
      if (grid.navigable[cell]) pixelCell[py * width + px] = cell;
    }
  }

  const chambers = clusters
    .map((group) => group.filter((cell) => grid.navigable[cell]))
    .filter((group) => group.length >= 2);

  return {
    width,
    height,
    cellCount: grid.cellCount,
    cellNeighbors,
    pixelCell,
    chambers,
  };
}

export function generateTemple(
  rng: Rng,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
): MazeMap {
  const grid = buildPolarGrid(rng, randomInt(rng, ...RING_RANGES[size]));
  carveMaze(rng, grid);
  const clusters = addChambers(rng, grid, Math.round(grid.nRings * 1.6));
  carveVoid(rng, grid, VOID_FRACTION[fill]);
  fillHoles(grid);
  reconnect(grid);
  braid(rng, grid);

  const layer = toCellLayer(grid, dims, clusters);
  return buildMazeMap(
    rng,
    layer,
    size,
    {
      voidColor: TEMPLE_VOID_COLOR,
      wallColor: TEMPLE_WALL_COLOR,
      seamColor: TEMPLE_SEAM_COLOR,
      tone: continentTempleTone,
      roundedWalls: true,
    },
    fill !== 'full',
  );
}
