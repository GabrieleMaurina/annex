import { timeStep } from '../../core/bench';
import { Fill, GridDimensions, MapSize } from '../../core/params';
import { randomFloat, randomInt, Rng } from '../../core/rng';
import { LinkRngs } from '../../links';
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
const MIN_RINGS = 3;
const MAX_CENTERS = 3;
const RADIUS_FACTOR_RANGE: [number, number] = [0.65, 1];
const OVERLAP_RANGE: [number, number] = [-0.21, 0.5];
const LAYOUT_MARGIN_FRACTION = 0.03;
const CROSS_OPEN_CHANCE = 0.85;
const MIN_CROSS_CONTACT_THICKNESS = 0.4;
const RING_JITTER = 0.32;
const DEAD_END_BRAID_CHANCE = 0.55;

const VOID_FRACTION: Record<Fill, number> = {
  full: 0.05,
  mixed: 0.35,
  sparse: 0.65,
};

const VOID_BLOB_RANGE: [number, number] = [2, 5];
const SEA_BLOB_RANGE: [number, number] = [15, 40];
const MIN_SEA_CONTACT = 2;

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

interface Maze {
  grid: PolarGrid;
  clusters: number[][];
  cx: number;
  cy: number;
  radius: number;
  priority: number;
  offset: number;
}

interface Point {
  x: number;
  y: number;
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

function carveVoid(
  rng: Rng,
  grid: PolarGrid,
  fraction: number,
  blobRange: [number, number],
): void {
  let target = Math.floor(grid.cellCount * fraction);
  let guard = 0;
  while (target > 0 && guard++ < grid.cellCount) {
    const seed = randomInt(rng, 0, grid.cellCount - 1);
    if (!grid.navigable[seed]) continue;
    const blob = randomInt(rng, ...blobRange);
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

function layoutMazes(
  relativeRadii: number[],
  overlaps: number[],
  dims: GridDimensions,
): { centers: Point[]; radii: number[] } {
  const { width, height } = dims;
  const margin = LAYOUT_MARGIN_FRACTION * Math.min(width, height);
  const distance = (a: number, b: number, overlap: number) =>
    relativeRadii[a] +
    relativeRadii[b] -
    overlap * Math.min(relativeRadii[a], relativeRadii[b]);

  const rough: Point[] = [{ x: 0, y: 0 }];
  if (relativeRadii.length >= 2) {
    rough.push({ x: distance(0, 1, overlaps[0]), y: 0 });
  }
  if (relativeRadii.length === 3) {
    const ab = rough[1].x;
    const ac = distance(0, 2, overlaps[1]);
    const bc = distance(1, 2, overlaps[2]);
    const x = (ac * ac - bc * bc + ab * ab) / (2 * ab);
    rough.push({ x, y: -Math.sqrt(Math.max(0, ac * ac - x * x)) });
  }

  const minX = Math.min(...rough.map((p, k) => p.x - relativeRadii[k]));
  const maxX = Math.max(...rough.map((p, k) => p.x + relativeRadii[k]));
  const minY = Math.min(...rough.map((p, k) => p.y - relativeRadii[k]));
  const maxY = Math.max(...rough.map((p, k) => p.y + relativeRadii[k]));
  const scale = Math.min(
    (width - 2 * margin) / (maxX - minX),
    (height - 2 * margin) / (maxY - minY),
  );
  return {
    centers: rough.map((p) => ({
      x: width / 2 + (p.x - (minX + maxX) / 2) * scale,
      y: height / 2 + (p.y - (minY + maxY) / 2) * scale,
    })),
    radii: relativeRadii.map((r) => r * scale),
  };
}

function buildMaze(
  rng: Rng,
  rings: number,
  fill: Fill,
  seas: boolean,
): { grid: PolarGrid; clusters: number[][] } {
  const grid = buildPolarGrid(rng, rings);
  carveMaze(rng, grid);
  const clusters = addChambers(rng, grid, Math.round(grid.nRings * 1.6));
  carveVoid(
    rng,
    grid,
    VOID_FRACTION[fill],
    seas ? SEA_BLOB_RANGE : VOID_BLOB_RANGE,
  );
  fillHoles(grid);
  braid(rng, grid);
  return { grid, clusters };
}

function ringOf(grid: PolarGrid, radiusFraction: number): number {
  for (let i = 1; i < grid.ringRadii.length; i++) {
    if (radiusFraction < grid.ringRadii[i]) return i - 1;
  }
  return grid.nRings - 1;
}

function cellAt(maze: Maze, dx: number, dy: number, distance: number): number {
  const { grid } = maze;
  const ring = ringOf(grid, distance / maze.radius);
  const count = grid.sectors[ring];
  let angle = Math.atan2(dy, dx) / (2 * Math.PI);
  if (angle < 0) angle += 1;
  const sector = Math.min(count - 1, Math.floor(angle * count));
  return maze.offset + grid.ringOffset[ring] + sector;
}

function dropDetachedFragments(
  pixelCell: Int32Array,
  outsideMask: Uint8Array,
  dims: GridDimensions,
  cellCount: number,
): void {
  const { width, height } = dims;
  const component = new Int32Array(pixelCell.length).fill(-1);
  const sizes: number[] = [];
  const largest = new Int32Array(cellCount);
  const stack: number[] = [];
  for (let start = 0; start < pixelCell.length; start++) {
    const cell = pixelCell[start];
    if (cell < 0 || component[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    component[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % width;
      const y = (i - x) / width;
      const around = [
        x > 0 ? i - 1 : -1,
        x + 1 < width ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y + 1 < height ? i + width : -1,
      ];
      for (const j of around) {
        if (j < 0 || component[j] !== -1 || pixelCell[j] !== cell) continue;
        component[j] = id;
        stack.push(j);
      }
    }
    sizes.push(size);
    largest[cell] = Math.max(largest[cell], size);
  }
  for (let i = 0; i < pixelCell.length; i++) {
    const cell = pixelCell[i];
    if (cell < 0 || sizes[component[i]] === largest[cell]) continue;
    pixelCell[i] = -1;
    outsideMask[i] = 1;
  }
}

function dropEmptyCells(
  pixelCell: Int32Array,
  cellNeighbors: number[][],
): void {
  const present = new Uint8Array(cellNeighbors.length);
  for (const cell of pixelCell) if (cell >= 0) present[cell] = 1;
  cellNeighbors.forEach((list, cell) => {
    cellNeighbors[cell] = present[cell] ? list.filter((n) => present[n]) : [];
  });
}

function openCrossLinks(
  rng: Rng,
  mazes: Maze[],
  pixelCell: Int32Array,
  dims: GridDimensions,
  cellNeighbors: number[][],
): void {
  const { width, height } = dims;
  const cellCount = cellNeighbors.length;
  const mazeOfCell = new Uint8Array(cellCount);
  mazes.forEach((maze, k) => {
    mazeOfCell.fill(k, maze.offset, maze.offset + maze.grid.cellCount);
  });

  const contacts = new Map<number, number>();
  const touch = (i: number, j: number) => {
    const a = pixelCell[i];
    const b = pixelCell[j];
    if (a < 0 || b < 0 || mazeOfCell[a] === mazeOfCell[b]) return;
    const key = a < b ? a * cellCount + b : b * cellCount + a;
    contacts.set(key, (contacts.get(key) ?? 0) + 1);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) touch(i, i + 1);
      if (y + 1 < height) touch(i, i + width);
    }
  }

  const thickness = Math.min(
    ...mazes.map((maze) => maze.radius / maze.grid.nRings),
  );
  const minContact = Math.max(
    2,
    Math.round(MIN_CROSS_CONTACT_THICKNESS * thickness),
  );
  const candidatesByPair = new Map<number, [number, number][]>();
  for (const [key, length] of contacts) {
    if (length < minContact) continue;
    const a = Math.floor(key / cellCount);
    const pair = mazeOfCell[a] * MAX_CENTERS + mazeOfCell[key % cellCount];
    const list = candidatesByPair.get(pair) ?? [];
    list.push([key, length]);
    candidatesByPair.set(pair, list);
  }

  for (const candidates of candidatesByPair.values()) {
    let opened = candidates.filter(() => rng() < CROSS_OPEN_CHANCE);
    if (opened.length === 0) {
      opened = [candidates.reduce((best, c) => (c[1] > best[1] ? c : best))];
    }
    for (const [key] of opened) {
      const a = Math.floor(key / cellCount);
      const b = key % cellCount;
      cellNeighbors[a].push(b);
      cellNeighbors[b].push(a);
    }
  }
}

function toCellLayer(rng: Rng, mazes: Maze[], dims: GridDimensions): CellLayer {
  const { width, height } = dims;

  const cellNeighbors: number[][] = [];
  for (const { grid, offset } of mazes) {
    for (let cell = 0; cell < grid.cellCount; cell++) {
      cellNeighbors.push(
        grid.potential[cell]
          .filter(
            (n) =>
              grid.navigable[cell] &&
              grid.navigable[n] &&
              grid.open.has(pairKey(cell, n)),
          )
          .map((n) => n + offset),
      );
    }
  }

  const pixelCell = new Int32Array(width * height).fill(-1);
  const outsideMask = new Uint8Array(width * height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const x = px + 0.5;
      const y = py + 0.5;
      let owner = -1;
      let ownerDistance = 0;
      for (let k = 0; k < mazes.length; k++) {
        const dx = x - mazes[k].cx;
        const dy = y - mazes[k].cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance >= mazes[k].radius) continue;
        if (owner >= 0 && mazes[k].priority < mazes[owner].priority) continue;
        owner = k;
        ownerDistance = distance;
      }
      const i = py * width + px;
      if (owner < 0) {
        outsideMask[i] = 1;
        continue;
      }
      const maze = mazes[owner];
      const cell = cellAt(maze, x - maze.cx, y - maze.cy, ownerDistance);
      if (maze.grid.navigable[cell - maze.offset]) pixelCell[i] = cell;
    }
  }

  if (mazes.length > 1) {
    dropDetachedFragments(pixelCell, outsideMask, dims, cellNeighbors.length);
    dropEmptyCells(pixelCell, cellNeighbors);
    openCrossLinks(rng, mazes, pixelCell, dims, cellNeighbors);
  }

  const chambers = mazes.flatMap(({ grid, clusters, offset }) =>
    clusters
      .map((group) =>
        group.filter((cell) => grid.navigable[cell]).map((c) => c + offset),
      )
      .filter((group) => group.length >= 2),
  );

  return {
    width,
    height,
    cellCount: cellNeighbors.length,
    cellNeighbors,
    pixelCell,
    chambers,
    outsideMask,
    minSeaContact: MIN_SEA_CONTACT,
  };
}

export function generateTemple(
  rng: Rng,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
  seas: boolean,
  linkRngs: LinkRngs,
): MazeMap {
  const layer = timeStep('shape', () => {
    const count = randomInt(rng, 1, MAX_CENTERS);
    const relativeRadii = Array.from({ length: count }, () =>
      randomFloat(rng, ...RADIUS_FACTOR_RANGE),
    );
    const overlaps = Array.from({ length: (count * (count - 1)) / 2 }, () =>
      randomFloat(rng, ...OVERLAP_RANGE),
    );
    const { centers, radii } = layoutMazes(relativeRadii, overlaps, dims);
    const baseRings = randomInt(rng, ...RING_RANGES[size]);
    const totalArea = radii.reduce((sum, r) => sum + r * r, 0);

    let offset = 0;
    const mazes: Maze[] = centers.map((center, k) => {
      const rings = Math.max(
        MIN_RINGS,
        Math.round(baseRings * Math.sqrt((radii[k] * radii[k]) / totalArea)),
      );
      const maze: Maze = {
        ...buildMaze(rng, rings, fill, seas),
        cx: center.x,
        cy: center.y,
        radius: radii[k],
        priority: rng(),
        offset,
      };
      offset += maze.grid.cellCount;
      return maze;
    });

    return toCellLayer(rng, mazes, dims);
  });
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
    seas,
    linkRngs,
  );
}
