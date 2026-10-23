import {
  createWarpField,
  enforceContiguity,
  expectedTerritoryArea,
  warpAt,
} from 'engine';
import {
  labelRegions,
  MAX_LAND_AREA_FRACTION,
  rgbOf,
} from '../../../game/regions/labelRegions';
import { wrapOf } from '../canvas/canvasGeometry';
import { wrapEdgeSegments } from '../mapCanvasGeometry';
import type { EditorTerritory as Territory } from '../model/editorTypes';
import {
  borderMask,
  gapMask,
  mergeDetachedPieces,
  onImageEdge,
  paintMask,
  visitNeighbors,
} from './territoryBorders';

const STRAIGHT = 3;
const DIAGONAL = 4;
const BUCKETS = DIAGONAL + 1;
const MAX_CELL_SCALE = 2;
const FULL_WARP_DISTANCE = 40;
const CLEANUP_PASSES = 3;

function seedSkeletons(
  sites: Territory[],
  byId: Map<number, Territory>,
  free: Uint8Array,
  width: number,
  height: number,
  dist: Int32Array,
  owner: Int32Array,
): number[] {
  const seeds: number[] = [];
  const seedRay = (site: Territory, toX: number, toY: number) => {
    const dx = toX - site.x;
    const dy = toY - site.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let s = 0; s <= steps; s++) {
      const x = Math.floor(site.x + (dx * s) / steps);
      const y = Math.floor(site.y + (dy * s) / steps);
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const p = y * width + x;
      if (!free[p]) return;
      if (dist[p] === 0) continue;
      dist[p] = 0;
      owner[p] = site.id;
      seeds.push(p);
    }
  };
  for (const site of sites) {
    seedRay(site, site.x, site.y);
    for (const otherId of [...site.neighbors, ...site.timed.map((m) => m.id)]) {
      const other = byId.get(otherId);
      if (!other) continue;
      const segments = wrapEdgeSegments(
        site,
        other,
        width,
        height,
        wrapOf(site, otherId),
      );
      if (segments.length > 1) continue;
      seedRay(site, (site.x + other.x) / 2, (site.y + other.y) / 2);
    }
  }
  return seeds;
}

function growCells(
  free: Uint8Array,
  width: number,
  dist: Int32Array,
  owner: Int32Array,
  seeds: number[],
  maxArea: number,
) {
  const size = free.length;
  const claimed = new Map<number, number>();
  const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);
  buckets[0] = seeds;
  let pending = seeds.length;
  for (let d = 0; pending > 0; d++) {
    const bucket = buckets[d % BUCKETS];
    for (const p of bucket) {
      if (dist[p] !== d) continue;
      const count = claimed.get(owner[p]) ?? 0;
      if (count >= maxArea) {
        owner[p] = -1;
        continue;
      }
      claimed.set(owner[p], count + 1);
      const x = p % width;
      const relax = (q: number, step: number) => {
        const next = d + step;
        if (!free[q] || next >= dist[q]) return;
        dist[q] = next;
        owner[q] = owner[p];
        buckets[next % BUCKETS].push(q);
        pending++;
      };
      const up = p >= width;
      const down = p + width < size;
      if (x > 0) {
        relax(p - 1, STRAIGHT);
        if (up) relax(p - width - 1, DIAGONAL);
        if (down) relax(p + width - 1, DIAGONAL);
      }
      if (x < width - 1) {
        relax(p + 1, STRAIGHT);
        if (up) relax(p - width + 1, DIAGONAL);
        if (down) relax(p + width + 1, DIAGONAL);
      }
      if (up) relax(p - width, STRAIGHT);
      if (down) relax(p + width, STRAIGHT);
    }
    pending -= bucket.length;
    buckets[d % BUCKETS] = [];
  }
}

function warpCells(
  free: Uint8Array,
  width: number,
  height: number,
  dist: Int32Array,
  owner: Int32Array,
): Int16Array {
  const field = createWarpField(Math.random, width, height);
  const cells = new Int16Array(owner.length);
  const warped = { x: 0, y: 0 };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      cells[p] = owner[p];
      if (!free[p]) continue;
      warpAt(field, x, y, warped);
      const fade = Math.min(1, dist[p] / (STRAIGHT * FULL_WARP_DISTANCE));
      const sx = Math.round(x + (warped.x - x) * fade);
      const sy = Math.round(y + (warped.y - y) * fade);
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const q = sy * width + sx;
      if (free[q]) cells[p] = owner[q];
    }
  enforceContiguity(cells, width, height);
  return cells;
}

function fillEnclosedGaps(
  free: Uint8Array,
  cells: Int16Array,
  width: number,
  maxGap: number,
) {
  const size = cells.length;
  const isGap = (q: number) => free[q] === 1 && cells[q] === -1;
  const visited = new Uint8Array(size);
  for (let start = 0; start < size; start++) {
    if (visited[start] || !isGap(start)) continue;
    const gap = [start];
    visited[start] = 1;
    let enclosed = true;
    for (let i = 0; i < gap.length; i++) {
      const p = gap[i];
      if (onImageEdge(p, width, size)) enclosed = false;
      visitNeighbors(p, width, size, (q) => {
        if (visited[q] || !isGap(q)) return;
        visited[q] = 1;
        gap.push(q);
      });
    }
    if (enclosed && gap.length < maxGap) for (const p of gap) cells[p] = -2;
  }

  const queue: number[] = [];
  for (let p = 0; p < size; p++) if (cells[p] >= 0) queue.push(p);
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    visitNeighbors(p, width, size, (q) => {
      if (cells[q] !== -2) return;
      cells[q] = cells[p];
      queue.push(q);
    });
  }
  for (let p = 0; p < size; p++) if (cells[p] === -2) cells[p] = -1;
}

export function drawTerritoryBorders(
  surface: ImageData,
  territories: Territory[],
  borderColors: string[],
  brushSize: number,
): boolean {
  const { width, height } = surface;
  const { labels, wall, invalidIds } = labelRegions(
    surface,
    territories,
    borderColors,
  );
  const color = rgbOf(borderColors[0]);
  const paintedGaps = paintMask(
    surface,
    gapMask(labels, wall, invalidIds, width, height, brushSize),
    color,
  );
  const sites = territories.filter((t) => invalidIds.has(t.id));
  if (sites.length === 0) return paintedGaps;
  const free = new Uint8Array(labels.length);
  for (let p = 0; p < labels.length; p++)
    if (labels[p] < 0 || invalidIds.has(labels[p])) free[p] = 1;

  const dist = new Int32Array(labels.length).fill(0x7fffffff);
  const owner = new Int32Array(labels.length).fill(-1);
  const byId = new Map(territories.map((t) => [t.id, t]));
  const seeds = seedSkeletons(sites, byId, free, width, height, dist, owner);
  const expectedArea = expectedTerritoryArea(width, height);
  const maxArea = Math.min(
    MAX_CELL_SCALE * expectedArea,
    MAX_LAND_AREA_FRACTION * width * height,
  );
  growCells(free, width, dist, owner, seeds, maxArea);
  const cells = warpCells(free, width, height, dist, owner);
  fillEnclosedGaps(free, cells, width, expectedArea);

  const nodePixels = new Set(
    sites
      .filter((t) => t.x >= 0 && t.y >= 0 && t.x < width && t.y < height)
      .map((t) => Math.floor(t.y) * width + Math.floor(t.x)),
  );
  let mask = borderMask(free, cells, width, height, brushSize);
  for (let pass = 0; pass < CLEANUP_PASSES; pass++) {
    const merged = mergeDetachedPieces(
      free,
      wall,
      cells,
      mask,
      width,
      nodePixels,
      expectedArea,
      brushSize + 2,
    );
    if (!merged) break;
    mask = borderMask(free, cells, width, height, brushSize);
  }
  return paintMask(surface, mask, color) || paintedGaps;
}
