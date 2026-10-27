import { Rng } from '../../core/rng';
import { createWarpField, warpAt } from '../../core/warp';
import { enforceContiguity } from '../contiguity';
import { GridPoint, placeTerritoryCenters } from '../placement';
import { FittedRegions, GIANT_RATIO } from './fit';
import { comparePlaces } from './ranks';
import { OsmPlace } from './types';

const SEED_CLASSES = [
  'city',
  'town',
  'village',
  'suburb',
  'quarter',
  'neighbourhood',
];
const MAX_PARTS = 6;
const MIN_SEED_SPACING = 0.5;

export interface CarvedRegions {
  grid: Int32Array;
  count: number;
  seedNames: Map<number, string>;
}

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Seed extends GridPoint {
  name: string;
}

function placeSeeds(
  grid: Int32Array,
  width: number,
  height: number,
  region: number,
  places: OsmPlace[],
  parts: number,
  area: number,
): Seed[] {
  const spacing = MIN_SEED_SPACING * Math.sqrt(area / parts);
  const candidates = places
    .filter((p) => {
      if (p.layer !== 'place' || !SEED_CLASSES.includes(p.cls)) return false;
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      return (
        x >= 0 &&
        y >= 0 &&
        x < width &&
        y < height &&
        grid[y * width + x] === region
      );
    })
    .sort(
      (a, b) =>
        SEED_CLASSES.indexOf(a.cls) - SEED_CLASSES.indexOf(b.cls) ||
        comparePlaces(a, b),
    );
  const seeds: Seed[] = [];
  for (const p of candidates) {
    if (seeds.length >= parts) break;
    if (seeds.some((s) => s.name === p.name)) continue;
    if (seeds.some((s) => Math.hypot(s.gx - p.x, s.gy - p.y) < spacing))
      continue;
    seeds.push({ gx: p.x, gy: p.y, name: p.name });
  }
  return seeds;
}

function splitRegion(
  grid: Int32Array,
  width: number,
  region: number,
  bounds: Bounds,
  seeds: Seed[],
  rng: Rng,
): Int16Array {
  const w = bounds.x1 - bounds.x0 + 1;
  const h = bounds.y1 - bounds.y0 + 1;
  const local = new Int16Array(w * h).fill(-1);
  const field = createWarpField(rng, w, h);
  const warped = { x: 0, y: 0 };
  for (let ly = 0; ly < h; ly++)
    for (let lx = 0; lx < w; lx++) {
      if (grid[(bounds.y0 + ly) * width + bounds.x0 + lx] !== region) continue;
      warpAt(field, lx, ly, warped);
      let best = 0;
      let bestDistance = Infinity;
      seeds.forEach((s, i) => {
        const d =
          (s.gx - bounds.x0 - warped.x) ** 2 +
          (s.gy - bounds.y0 - warped.y) ** 2;
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      local[ly * w + lx] = best;
    }
  enforceContiguity(local, w, h);
  return local;
}

function mergeSmallParts(
  grid: Int32Array,
  width: number,
  area: number[],
  minArea: number,
  seedNames: Map<number, string>,
): void {
  const borders = area.map(() => new Map<number, number>());
  const link = (a: number, b: number) => {
    if (a < 0 || b < 0 || a === b) return;
    borders[a].set(b, (borders[a].get(b) ?? 0) + 1);
    borders[b].set(a, (borders[b].get(a) ?? 0) + 1);
  };
  for (let i = 0; i < grid.length; i++) {
    if ((i + 1) % width !== 0) link(grid[i], grid[i + 1]);
    if (i + width < grid.length) link(grid[i], grid[i + width]);
  }
  const owner = area.map((_, region) => region);
  for (;;) {
    let small = -1;
    for (let r = 0; r < area.length; r++)
      if (
        owner[r] === r &&
        area[r] < minArea &&
        borders[r].size > 0 &&
        (small < 0 || area[r] < area[small])
      )
        small = r;
    if (small < 0) break;
    const into = [...borders[small].entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    owner[small] = into;
    area[into] += area[small];
    for (const [neighbor, length] of borders[small]) {
      borders[neighbor].delete(small);
      if (neighbor === into) continue;
      borders[neighbor].set(into, (borders[neighbor].get(into) ?? 0) + length);
      borders[into].set(neighbor, (borders[into].get(neighbor) ?? 0) + length);
    }
    borders[small].clear();
    seedNames.delete(small);
  }
  const root = (r: number): number => (owner[r] === r ? r : root(owner[r]));
  for (let i = 0; i < grid.length; i++)
    if (grid[i] >= 0) grid[i] = root(grid[i]);
}

function emptyBounds(): Bounds {
  return { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
}

function extend(b: Bounds, x: number, y: number): void {
  if (x < b.x0) b.x0 = x;
  if (x > b.x1) b.x1 = x;
  if (y < b.y0) b.y0 = y;
  if (y > b.y1) b.y1 = y;
}

function regionBounds(
  grid: Int32Array,
  width: number,
  count: number,
): { area: number[]; bounds: Bounds[] } {
  const area = new Array(count).fill(0);
  const bounds = Array.from({ length: count }, emptyBounds);
  for (let i = 0; i < grid.length; i++) {
    const r = grid[i];
    if (r < 0) continue;
    area[r]++;
    extend(bounds[r], i % width, Math.floor(i / width));
  }
  return { area, bounds };
}

export function carveRegions(
  fitted: FittedRegions,
  width: number,
  height: number,
  places: OsmPlace[],
  minArea: number,
  targetArea: number,
  [min, max]: [number, number],
  rng: Rng,
): CarvedRegions {
  const grid = fitted.grid;
  let count = fitted.count;
  const { area, bounds } = regionBounds(grid, width, count);
  const seedNames = new Map<number, string>();
  const unsplittable = new Set<number>();
  for (;;) {
    const needMore = count < min;
    if (!needMore && count >= max) break;
    let target = -1;
    for (let r = 0; r < count; r++)
      if (
        !unsplittable.has(r) &&
        area[r] >= 2 * minArea &&
        (needMore ||
          (fitted.balance
            ? Math.round(area[r] / targetArea) >= 2
            : area[r] >= GIANT_RATIO * targetArea)) &&
        (target < 0 || area[r] > area[target])
      )
        target = r;
    if (target < 0) break;
    const wanted = Math.max(2, Math.round(area[target] / targetArea));
    const parts = Math.min(
      MAX_PARTS,
      needMore ? Math.max(wanted, min - count + 1) : wanted,
      max - count + 1,
      Math.floor(area[target] / minArea),
    );
    const box = bounds[target];
    const w = box.x1 - box.x0 + 1;
    const h = box.y1 - box.y0 + 1;
    const local = new Uint8Array(w * h);
    for (let ly = 0; ly < h; ly++)
      for (let lx = 0; lx < w; lx++)
        if (grid[(box.y0 + ly) * width + box.x0 + lx] === target)
          local[ly * w + lx] = 1;
    let seeds = placeSeeds(
      grid,
      width,
      height,
      target,
      places,
      parts,
      area[target],
    );
    if (seeds.length < 2)
      seeds = placeTerritoryCenters(rng, local, w, h, parts).map((p) => ({
        gx: p.gx + box.x0,
        gy: p.gy + box.y0,
        name: '',
      }));
    if (seeds.length < 2) {
      unsplittable.add(target);
      continue;
    }
    const labels = splitRegion(grid, width, target, box, seeds, rng);
    const idOf = new Map<number, number>();
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label < 0 || idOf.has(label)) continue;
      idOf.set(label, idOf.size === 0 ? target : count++);
    }
    if (idOf.size < 2) {
      unsplittable.add(target);
      continue;
    }
    for (const [label, id] of idOf) {
      if (seeds[label].name) seedNames.set(id, seeds[label].name);
      else seedNames.delete(id);
      area[id] = 0;
      bounds[id] = emptyBounds();
    }
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label < 0) continue;
      const id = idOf.get(label)!;
      const x = box.x0 + (i % w);
      const y = box.y0 + Math.floor(i / w);
      grid[y * width + x] = id;
      area[id]++;
      extend(bounds[id], x, y);
    }
  }
  mergeSmallParts(grid, width, area, minArea, seedNames);
  return { grid, count, seedNames };
}
