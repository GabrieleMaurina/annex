import { Fill, GridDimensions, MapSize } from '../../core/params';
import { randomInt, Rng } from '../../core/rng';
import {
  continentDungeonTone,
  DUNGEON_SEAM_COLOR,
  DUNGEON_VOID_COLOR,
  DUNGEON_WALL_COLOR,
} from '../../render/palette';
import { CellLayer } from './cellLayer';
import { buildMazeMap, MazeMap } from './mazeMap';

const ROW_RANGES: Record<MapSize, [number, number]> = {
  small: [7, 9],
  medium: [10, 12],
  large: [13, 15],
  xlarge: [14, 16],
};
const DEAD_END_BRAID_CHANCE = 0.5;
const DOOR_CHANCE = 0.35;
const TRACK_JITTER = 0.4;

const VOID_FRACTION: Record<Fill, number> = {
  full: 0.05,
  mixed: 0.14,
  sparse: 0.28,
};

interface CoarseGrid {
  cols: number;
  rows: number;
  colEdges: number[];
  rowEdges: number[];
  navigable: Uint8Array;
  roomId: Int32Array;
  passages: Set<string>;
}

function jitteredEdges(rng: Rng, count: number, total: number): number[] {
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const w = 1 + (rng() * 2 - 1) * TRACK_JITTER;
    weights.push(w);
    sum += w;
  }
  const edges = [0];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    acc += weights[i];
    edges.push(Math.round((acc / sum) * total));
  }
  edges[count] = total;
  return edges;
}

function trackIndex(edges: number[], value: number): number {
  for (let i = 1; i < edges.length; i++) {
    if (value < edges[i]) return i - 1;
  }
  return edges.length - 2;
}

interface CoarseNeighbor {
  nc: number;
  dir: 'h' | 'v';
  ex: number;
  ey: number;
}

function edgeKey(dir: 'h' | 'v', cx: number, cy: number): string {
  return `${dir}:${cx},${cy}`;
}

function neighborsOfCoarse(grid: CoarseGrid, c: number): CoarseNeighbor[] {
  const { cols, rows } = grid;
  const cx = c % cols;
  const cy = (c / cols) | 0;
  const out: CoarseNeighbor[] = [];
  if (cx > 0) out.push({ nc: c - 1, dir: 'h', ex: cx - 1, ey: cy });
  if (cx + 1 < cols) out.push({ nc: c + 1, dir: 'h', ex: cx, ey: cy });
  if (cy > 0) out.push({ nc: c - cols, dir: 'v', ex: cx, ey: cy - 1 });
  if (cy + 1 < rows) out.push({ nc: c + cols, dir: 'v', ex: cx, ey: cy });
  return out;
}

function placeRooms(rng: Rng, grid: CoarseGrid, attempts: number): void {
  const { cols, rows, navigable, roomId, passages } = grid;
  let nextRoom = 0;
  for (let a = 0; a < attempts; a++) {
    const big = rng() < 0.5;
    const rw = big ? randomInt(rng, 2, 3) : randomInt(rng, 1, 2);
    const rh = big ? randomInt(rng, 2, 3) : 1;
    if (rw >= cols || rh >= rows) continue;
    const rx = randomInt(rng, 0, cols - rw);
    const ry = randomInt(rng, 0, rows - rh);
    let clear = true;
    for (let y = ry - 1; y <= ry + rh && clear; y++) {
      for (let x = rx - 1; x <= rx + rw && clear; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        if (roomId[y * cols + x] !== -1) clear = false;
      }
    }
    if (!clear) continue;
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        const c = y * cols + x;
        navigable[c] = 1;
        roomId[c] = nextRoom;
        if (x + 1 < rx + rw) passages.add(edgeKey('h', x, y));
        if (y + 1 < ry + rh) passages.add(edgeKey('v', x, y));
      }
    }
    nextRoom++;
  }
}

function carveFrom(
  rng: Rng,
  grid: CoarseGrid,
  start: number,
  visited: Uint8Array,
): void {
  const { navigable, roomId, passages } = grid;
  const stack = [start];
  visited[start] = 1;
  navigable[start] = 1;
  while (stack.length > 0) {
    const c = stack[stack.length - 1];
    const options: CoarseNeighbor[] = [];
    for (const n of neighborsOfCoarse(grid, c)) {
      if (!visited[n.nc] && roomId[n.nc] === -1) options.push(n);
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const chosen = options[randomInt(rng, 0, options.length - 1)];
    passages.add(edgeKey(chosen.dir, chosen.ex, chosen.ey));
    visited[chosen.nc] = 1;
    navigable[chosen.nc] = 1;
    stack.push(chosen.nc);
  }
}

function carveMaze(rng: Rng, grid: CoarseGrid): void {
  const { cols, rows, roomId } = grid;
  const visited = new Uint8Array(cols * rows);
  for (let c = 0; c < cols * rows; c++) {
    if (roomId[c] === -1 && !visited[c]) carveFrom(rng, grid, c, visited);
  }
}

function addDoors(rng: Rng, grid: CoarseGrid): void {
  const { cols, rows, navigable, roomId, passages } = grid;
  const rooms = new Map<number, number[]>();
  for (let c = 0; c < cols * rows; c++) {
    if (roomId[c] === -1) continue;
    const list = rooms.get(roomId[c]) ?? [];
    list.push(c);
    rooms.set(roomId[c], list);
  }
  for (const cells of rooms.values()) {
    const candidates: string[] = [];
    for (const c of cells) {
      for (const { nc, dir, ex, ey } of neighborsOfCoarse(grid, c)) {
        if (roomId[nc] === roomId[c] || !navigable[nc]) continue;
        const key = edgeKey(dir, ex, ey);
        if (!passages.has(key)) candidates.push(key);
      }
    }
    if (candidates.length === 0) continue;
    const first = candidates[randomInt(rng, 0, candidates.length - 1)];
    passages.add(first);
    for (const key of candidates) {
      if (key !== first && rng() < DOOR_CHANCE) passages.add(key);
    }
  }
}

function braid(rng: Rng, grid: CoarseGrid): void {
  const { cols, rows, navigable, roomId, passages } = grid;
  for (let c = 0; c < cols * rows; c++) {
    if (!navigable[c] || roomId[c] !== -1) continue;
    const links = neighborsOfCoarse(grid, c).filter(({ dir, ex, ey }) =>
      passages.has(edgeKey(dir, ex, ey)),
    );
    if (links.length !== 1) continue;
    if (rng() >= DEAD_END_BRAID_CHANCE) continue;
    const closed = neighborsOfCoarse(grid, c).filter(
      ({ nc, dir, ex, ey }) =>
        navigable[nc] && !passages.has(edgeKey(dir, ex, ey)),
    );
    if (closed.length === 0) continue;
    const pick = closed[randomInt(rng, 0, closed.length - 1)];
    passages.add(edgeKey(pick.dir, pick.ex, pick.ey));
  }
}

function carveVoid(rng: Rng, grid: CoarseGrid, fraction: number): void {
  const { cols, rows, navigable, passages } = grid;
  const total = cols * rows;
  let navCount = 0;
  for (let c = 0; c < total; c++) if (navigable[c]) navCount++;
  let target = Math.floor(navCount * fraction);

  const removeCell = (c: number) => {
    navigable[c] = 0;
    const cx = c % cols;
    const cy = (c / cols) | 0;
    passages.delete(edgeKey('h', cx, cy));
    passages.delete(edgeKey('h', cx - 1, cy));
    passages.delete(edgeKey('v', cx, cy));
    passages.delete(edgeKey('v', cx, cy - 1));
  };

  let guard = 0;
  while (target > 0 && guard++ < total) {
    const seed = randomInt(rng, 0, total - 1);
    if (!navigable[seed]) continue;
    const blob = randomInt(rng, 2, 5);
    const queue = [seed];
    let head = 0;
    let removed = 0;
    while (head < queue.length && target > 0 && removed < blob) {
      const c = queue[head++];
      if (!navigable[c]) continue;
      removeCell(c);
      target--;
      removed++;
      for (const { nc } of neighborsOfCoarse(grid, c)) {
        if (navigable[nc] && rng() < 0.5) queue.push(nc);
      }
    }
  }

  for (let c = 0; c < total; c++) {
    if (!navigable[c] || grid.roomId[c] !== -1) continue;
    const hasLink = neighborsOfCoarse(grid, c).some(({ dir, ex, ey }) =>
      passages.has(edgeKey(dir, ex, ey)),
    );
    if (!hasLink) removeCell(c);
  }
}

function fillHoles(grid: CoarseGrid): void {
  const { cols, rows, navigable, passages } = grid;
  for (let c = 0; c < cols * rows; c++) {
    if (navigable[c]) continue;
    const around = neighborsOfCoarse(grid, c);
    if (around.length < 3 || around.some(({ nc }) => !navigable[nc])) continue;
    navigable[c] = 1;
    for (const { dir, ex, ey } of around) passages.add(edgeKey(dir, ex, ey));
  }
}

function reconnect(rng: Rng, grid: CoarseGrid): void {
  const { cols, rows, navigable, passages } = grid;
  const total = cols * rows;
  const componentOf = new Int32Array(total).fill(-1);
  const components: number[][] = [];
  for (let start = 0; start < total; start++) {
    if (!navigable[start] || componentOf[start] !== -1) continue;
    const id = components.length;
    const stack = [start];
    componentOf[start] = id;
    const members = [start];
    while (stack.length > 0) {
      const c = stack.pop()!;
      for (const { nc, dir, ex, ey } of neighborsOfCoarse(grid, c)) {
        if (
          navigable[nc] &&
          componentOf[nc] === -1 &&
          passages.has(edgeKey(dir, ex, ey))
        ) {
          componentOf[nc] = id;
          stack.push(nc);
          members.push(nc);
        }
      }
    }
    components.push(members);
  }
  if (components.length <= 1) return;

  components.sort((a, b) => b.length - a.length);
  const joined = new Set(components[0]);
  for (let k = 1; k < components.length; k++) {
    const bridges: { dir: 'h' | 'v'; ex: number; ey: number }[] = [];
    for (const c of components[k]) {
      for (const { nc, dir, ex, ey } of neighborsOfCoarse(grid, c)) {
        if (navigable[nc] && joined.has(nc)) bridges.push({ dir, ex, ey });
      }
    }
    if (bridges.length === 0) continue;
    const pick = bridges[randomInt(rng, 0, bridges.length - 1)];
    passages.add(edgeKey(pick.dir, pick.ex, pick.ey));
    for (const c of components[k]) joined.add(c);
  }
}

function toCellLayer(grid: CoarseGrid, dims: GridDimensions): CellLayer {
  const { cols, rows, navigable, roomId, passages } = grid;
  const total = cols * rows;

  const cellId = new Int32Array(total).fill(-1);
  let cellCount = 0;
  for (let c = 0; c < total; c++) {
    if (navigable[c]) cellId[c] = cellCount++;
  }

  const chamberCells = new Map<number, number[]>();
  for (let c = 0; c < total; c++) {
    if (cellId[c] < 0 || roomId[c] < 0) continue;
    const list = chamberCells.get(roomId[c]) ?? [];
    list.push(cellId[c]);
    chamberCells.set(roomId[c], list);
  }
  const chambers = [...chamberCells.values()].filter((g) => g.length >= 2);

  const cellNeighbors: number[][] = Array.from({ length: cellCount }, () => []);
  for (let c = 0; c < total; c++) {
    const id = cellId[c];
    if (id < 0) continue;
    for (const { nc, dir, ex, ey } of neighborsOfCoarse(grid, c)) {
      if (nc < c) continue;
      const other = cellId[nc];
      if (other < 0 || !passages.has(edgeKey(dir, ex, ey))) continue;
      cellNeighbors[id].push(other);
      cellNeighbors[other].push(id);
    }
  }

  const rowForY: number[] = [];
  for (let py = 0; py < dims.height; py++) {
    rowForY.push(Math.min(rows - 1, trackIndex(grid.rowEdges, py)));
  }
  const pixelCell = new Int32Array(dims.width * dims.height);
  for (let px = 0; px < dims.width; px++) {
    const cx = Math.min(cols - 1, trackIndex(grid.colEdges, px));
    for (let py = 0; py < dims.height; py++) {
      pixelCell[py * dims.width + px] = cellId[rowForY[py] * cols + cx];
    }
  }

  return {
    width: dims.width,
    height: dims.height,
    cellCount,
    cellNeighbors,
    pixelCell,
    chambers,
  };
}

export function generateDungeon(
  rng: Rng,
  fill: Fill,
  size: MapSize,
  dims: GridDimensions,
): MazeMap {
  const rows = randomInt(rng, ...ROW_RANGES[size]);
  const cols = Math.round((rows * dims.width) / dims.height);
  const grid: CoarseGrid = {
    cols,
    rows,
    colEdges: jitteredEdges(rng, cols, dims.width),
    rowEdges: jitteredEdges(rng, rows, dims.height),
    navigable: new Uint8Array(cols * rows),
    roomId: new Int32Array(cols * rows).fill(-1),
    passages: new Set(),
  };

  placeRooms(rng, grid, Math.round((cols * rows) / 13));
  carveMaze(rng, grid);
  addDoors(rng, grid);
  carveVoid(rng, grid, VOID_FRACTION[fill]);
  fillHoles(grid);
  reconnect(rng, grid);
  braid(rng, grid);

  const layer = toCellLayer(grid, dims);
  return buildMazeMap(
    rng,
    layer,
    size,
    {
      voidColor: DUNGEON_VOID_COLOR,
      wallColor: DUNGEON_WALL_COLOR,
      seamColor: DUNGEON_SEAM_COLOR,
      tone: continentDungeonTone,
    },
    fill !== 'full',
  );
}
