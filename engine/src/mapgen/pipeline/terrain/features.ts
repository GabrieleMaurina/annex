import { Fill } from '../../core/params';
import { randomFloat, randomInt, Rng } from '../../core/rng';
import { MOUNTAIN_VOID, RANGE_VOID, RIVER_VOID } from '../../render/gif';
import { largeLandAreas } from '../osm/raster/nature';

export interface TerrainToggles {
  mountains: boolean;
  rivers: boolean;
}

const MOUNTAIN_SHARE: Record<Fill, number> = {
  full: 0.12,
  mixed: 0.08,
  sparse: 0,
};
const SNOW_SHARE = 0.3;
const MOUNTAIN_AREA_RATIO = 0.1;
const RIVER_COUNT: Record<Fill, number> = { full: 9, mixed: 7, sparse: 4 };
const RIVER_SOURCE_SHARE = 0.15;
const RIVER_SPACING = 0.12;
const RIVER_TRIES = 80;
const RIVER_STEP = 6;
const RIVER_WOBBLE = 2.5;
const RIVER_RADIUS = 5;
const MIN_RIVER_POINTS = 40;
const RIVER_SHORE = 3;
const MIN_RIVER_PIXELS = 800;
const DIRECTIONS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function sortedHeights(heights: Float32Array, mask: Uint8Array): Float32Array {
  return heights.filter((_, i) => mask[i] === 1).sort();
}

function levelOf(sorted: Float32Array, share: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - share)))
  ];
}

function addMountains(
  voidMask: Uint8Array,
  land: Uint8Array,
  heights: Float32Array,
  landHeights: Float32Array,
  fill: Fill,
  width: number,
  minArea: number,
): void {
  if (MOUNTAIN_SHARE[fill] === 0) return;
  const level = levelOf(landHeights, MOUNTAIN_SHARE[fill]);
  const high = Uint8Array.from(heights, (h, i) =>
    land[i] && h >= level ? 1 : 0,
  );
  const mountains = largeLandAreas(high, land, width, minArea);
  if (!mountains.includes(1)) return;
  const snow = levelOf(sortedHeights(heights, mountains), SNOW_SHARE);
  for (let i = 0; i < voidMask.length; i++)
    if (mountains[i])
      voidMask[i] = heights[i] >= snow ? MOUNTAIN_VOID : RANGE_VOID;
}

function traceRiver(
  rng: Rng,
  start: number,
  land: Uint8Array,
  heights: Float32Array,
  rivers: Uint8Array,
  width: number,
  height: number,
): number[] | null {
  const columns = Math.ceil(width / RIVER_STEP);
  const cell = (x: number, y: number) =>
    Math.floor(y / RIVER_STEP) * columns + Math.floor(x / RIVER_STEP);
  const visited = new Set<number>();
  let x = start % width;
  let y = Math.floor(start / width);
  const points = [x, y];
  for (let step = 0; step < (width + height) / RIVER_STEP; step++) {
    visited.add(cell(x, y));
    let next: [number, number] | null = null;
    let lowest = Infinity;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx * RIVER_STEP;
      const ny = y + dy * RIVER_STEP;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited.has(cell(nx, ny))) continue;
      if (heights[ny * width + nx] < lowest) {
        lowest = heights[ny * width + nx];
        next = [nx, ny];
      }
    }
    if (!next) return null;
    [x, y] = next;
    points.push(
      x + randomFloat(rng, -RIVER_WOBBLE, RIVER_WOBBLE),
      y + randomFloat(rng, -RIVER_WOBBLE, RIVER_WOBBLE),
    );
    const i = y * width + x;
    if (!land[i] || rivers[i])
      return points.length / 2 >= MIN_RIVER_POINTS ? points : null;
  }
  return null;
}

function drawRiver(
  rivers: Uint8Array,
  points: number[],
  width: number,
  height: number,
): void {
  for (let p = 0; p + 3 < points.length; p += 2) {
    const dx = points[p + 2] - points[p];
    const dy = points[p + 3] - points[p + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(points[p] + (dx * s) / steps);
      const cy = Math.round(points[p + 1] + (dy * s) / steps);
      for (let oy = -RIVER_RADIUS; oy <= RIVER_RADIUS; oy++)
        for (let ox = -RIVER_RADIUS; ox <= RIVER_RADIUS; ox++) {
          const x = cx + ox;
          const y = cy + oy;
          if (ox * ox + oy * oy > RIVER_RADIUS * RIVER_RADIUS) continue;
          if (x >= 0 && y >= 0 && x < width && y < height)
            rivers[y * width + x] = 1;
        }
    }
  }
}

function addRivers(
  rng: Rng,
  voidMask: Uint8Array,
  land: Uint8Array,
  heights: Float32Array,
  landHeights: Float32Array,
  fill: Fill,
  width: number,
  height: number,
): void {
  const source = levelOf(landHeights, RIVER_SOURCE_SHARE);
  const spacing = RIVER_SPACING * width;
  const rivers = new Uint8Array(land.length);
  const sources: number[] = [];
  for (
    let attempt = 0;
    attempt < RIVER_COUNT[fill] * RIVER_TRIES &&
    sources.length < RIVER_COUNT[fill];
    attempt++
  ) {
    const start = randomInt(rng, 0, land.length - 1);
    if (!land[start] || heights[start] < source) continue;
    const far = sources.every(
      (other) =>
        Math.hypot(
          (other % width) - (start % width),
          Math.floor(other / width) - Math.floor(start / width),
        ) >= spacing,
    );
    if (!far) continue;
    const points = traceRiver(rng, start, land, heights, rivers, width, height);
    if (!points) continue;
    sources.push(start);
    drawRiver(rivers, points, width, height);
  }
  for (let i = 0; i < voidMask.length; i++)
    if (rivers[i] && land[i] && !voidMask[i]) voidMask[i] = RIVER_VOID;
}

function nearMask(
  mask: Uint8Array,
  width: number,
  height: number,
  reach: number,
): Uint8Array {
  const rows = new Uint8Array(mask.length);
  const near = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let d = -reach; d <= reach; d++)
        if (x + d >= 0 && x + d < width && mask[y * width + x + d]) {
          rows[y * width + x] = 1;
          break;
        }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let d = -reach; d <= reach; d++)
        if (y + d >= 0 && y + d < height && rows[(y + d) * width + x]) {
          near[y * width + x] = 1;
          break;
        }
  return near;
}

export function trimRivers(
  voidMask: Uint8Array,
  land: Uint8Array,
  width: number,
  height: number,
): void {
  const water = Uint8Array.from(land, (inside, i) =>
    !inside && !voidMask[i] ? 1 : 0,
  );
  const near = nearMask(water, width, height, RIVER_RADIUS + RIVER_SHORE);
  for (let i = 0; i < voidMask.length; i++)
    if (voidMask[i] === RIVER_VOID && near[i]) {
      voidMask[i] = 0;
      land[i] = 1;
    }
}

export function settleRivers(
  voidMask: Uint8Array,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  width: number,
  height: number,
): void {
  const reach = RIVER_RADIUS + RIVER_SHORE;
  const absorbed: [number, number][] = [];
  for (let i = 0; i < voidMask.length; i++) {
    if (voidMask[i] !== RIVER_VOID) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    let only = -1;
    let divides = false;
    for (let dy = -reach; dy <= reach && !divides; dy++)
      for (let dx = -reach; dx <= reach && !divides; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const label = labelGrid[ny * width + nx];
        if (label < 0) continue;
        if (only < 0) only = label;
        else if (label !== only) divides = true;
      }
    if (!divides && only >= 0) absorbed.push([i, only]);
  }
  for (const [i, label] of absorbed) {
    voidMask[i] = 0;
    labelGrid[i] = label;
  }
  for (const [i] of absorbed)
    linkNeighbours(i, labelGrid, adjacency, width, height);
  for (const piece of riverPieces(voidMask, width, height))
    if (
      piece.length < MIN_RIVER_PIXELS ||
      !separatesTerritories(piece, labelGrid, adjacency, width, height)
    )
      fillPiece(piece, voidMask, labelGrid, adjacency, width, height);
}

function separatesTerritories(
  piece: number[],
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  width: number,
  height: number,
): boolean {
  const reach = RIVER_RADIUS + RIVER_SHORE;
  for (const p of piece) {
    const x = p % width;
    const y = Math.floor(p / width);
    const labels = new Set<number>();
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const label = labelGrid[ny * width + nx];
        if (label >= 0) labels.add(label);
      }
    for (const a of labels)
      for (const b of labels)
        if (a < b && !adjacency.get(a)?.has(b)) return true;
  }
  return false;
}

function neighbours(i: number, width: number, height: number): number[] {
  const x = i % width;
  const result: number[] = [];
  if (x > 0) result.push(i - 1);
  if (x < width - 1) result.push(i + 1);
  if (i >= width) result.push(i - width);
  if (i + width < width * height) result.push(i + width);
  return result;
}

function riverPieces(
  voidMask: Uint8Array,
  width: number,
  height: number,
): number[][] {
  const seen = new Uint8Array(voidMask.length);
  const pieces: number[][] = [];
  for (let start = 0; start < voidMask.length; start++) {
    if (voidMask[start] !== RIVER_VOID || seen[start]) continue;
    const piece = [start];
    seen[start] = 1;
    for (let k = 0; k < piece.length; k++)
      for (const n of neighbours(piece[k], width, height))
        if (voidMask[n] === RIVER_VOID && !seen[n]) {
          seen[n] = 1;
          piece.push(n);
        }
    pieces.push(piece);
  }
  return pieces;
}

function linkNeighbours(
  i: number,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  width: number,
  height: number,
): void {
  for (const n of neighbours(i, width, height)) {
    const a = labelGrid[i];
    const b = labelGrid[n];
    if (b < 0 || a === b) continue;
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }
}

function fillPiece(
  piece: number[],
  voidMask: Uint8Array,
  labelGrid: Int16Array,
  adjacency: Map<number, Set<number>>,
  width: number,
  height: number,
): void {
  const inPiece = new Set(piece);
  const queue: number[] = [];
  for (const p of piece)
    for (const n of neighbours(p, width, height))
      if (!inPiece.has(n) && labelGrid[n] >= 0) {
        labelGrid[p] = labelGrid[n];
        queue.push(p);
        break;
      }
  for (let k = 0; k < queue.length; k++)
    for (const n of neighbours(queue[k], width, height))
      if (inPiece.has(n) && labelGrid[n] < 0) {
        labelGrid[n] = labelGrid[queue[k]];
        queue.push(n);
      }
  for (const p of piece) {
    if (labelGrid[p] < 0) continue;
    voidMask[p] = 0;
    linkNeighbours(p, labelGrid, adjacency, width, height);
  }
}

export function terrainFeatures(
  rng: Rng,
  land: Uint8Array,
  heights: Float32Array,
  fill: Fill,
  width: number,
  height: number,
  expectedTerritoryArea: number,
  toggles: TerrainToggles,
): Uint8Array {
  const voidMask = new Uint8Array(land.length);
  if (!toggles.mountains && !toggles.rivers) return voidMask;
  const landHeights = sortedHeights(heights, land);
  if (toggles.mountains)
    addMountains(
      voidMask,
      land,
      heights,
      landHeights,
      fill,
      width,
      expectedTerritoryArea * MOUNTAIN_AREA_RATIO,
    );
  if (toggles.rivers)
    addRivers(rng, voidMask, land, heights, landHeights, fill, width, height);
  return voidMask;
}
