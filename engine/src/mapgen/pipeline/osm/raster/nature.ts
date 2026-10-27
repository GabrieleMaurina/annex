import { OsmFeatures, OsmWater } from '../types';
import { fillRings, strokeLine } from './rasterize';
import { smoothCoast } from './smooth';

const MOUNTAIN_CLASSES = ['rock', 'ice'];
const RIVER_LENGTH_RATIO = 0.25;
const RIVER_REACH = 4;
const RIVER_SHARE = 0.6;
const MIN_RIVER_BORDER = 12;
const PAIR_KEY_BASE = 65536;

export interface RiverBorders {
  rivers: [number, number][];
  bridges: number[];
}

function areaMask(
  areas: OsmWater[],
  classes: string[],
  width: number,
  height: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const area of areas)
    if (classes.includes(area.cls))
      fillRings(mask, width, height, area.rings, 1);
  smoothCoast(mask, width, height);
  return mask;
}

export function mountainMask(
  features: OsmFeatures,
  width: number,
  height: number,
): Uint8Array {
  return areaMask(features.landcover, MOUNTAIN_CLASSES, width, height);
}

export function lakeMask(
  features: OsmFeatures,
  width: number,
  height: number,
): Uint8Array {
  return areaMask(features.water, ['lake'], width, height);
}

export function keepLakes(
  land: Uint8Array,
  lakes: Uint8Array,
  width: number,
  minArea: number,
): void {
  const seen = new Uint8Array(lakes.length);
  const stack: number[] = [];
  for (let start = 0; start < lakes.length; start++) {
    if (!lakes[start] || seen[start]) continue;
    const cells: number[] = [];
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const c = stack.pop()!;
      cells.push(c);
      const x = c % width;
      for (const n of [
        x > 0 ? c - 1 : -1,
        x < width - 1 ? c + 1 : -1,
        c - width,
        c + width,
      ])
        if (n >= 0 && n < lakes.length && lakes[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
    }
    if (cells.length >= minArea) for (const c of cells) land[c] = 0;
  }
}

function riverMask(
  features: OsmFeatures,
  width: number,
  height: number,
): Uint8Array {
  const rivers = features.lines.filter(
    (line) => line.layer === 'waterway' && line.cls === 'river' && line.name,
  );
  const lengths = new Map<string, number>();
  for (const { name, points } of rivers) {
    let length = 0;
    for (let i = 0; i + 3 < points.length; i += 2)
      length += Math.hypot(
        points[i + 2] - points[i],
        points[i + 3] - points[i + 1],
      );
    lengths.set(name, (lengths.get(name) ?? 0) + length);
  }
  const minLength = RIVER_LENGTH_RATIO * Math.sqrt(width * height);
  const mask = new Uint8Array(width * height);
  for (const { name, points } of rivers)
    if (lengths.get(name)! >= minLength)
      strokeLine(mask, width, height, points, 1);
  const near = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -RIVER_REACH; dy <= RIVER_REACH; dy++)
        for (let dx = -RIVER_REACH; dx <= RIVER_REACH; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height)
            near[ny * width + nx] = 1;
        }
    }
  return near;
}

function connected(
  adjacency: Map<number, Set<number>>,
  from: number,
  to: number,
): boolean {
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length > 0) {
    const t = stack.pop()!;
    if (t === to) return true;
    for (const n of adjacency.get(t) ?? [])
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
  }
  return false;
}

export function cutRiverBorders(
  features: OsmFeatures,
  labelGrid: Int16Array,
  width: number,
  height: number,
  adjacency: Map<number, Set<number>>,
): RiverBorders {
  const river = riverMask(features, width, height);
  const border = new Map<number, { river: number; pixels: number[] }>();
  const count = (i: number, j: number) => {
    const a = labelGrid[i];
    const b = labelGrid[j];
    if (a < 0 || b < 0 || a === b) return;
    const key = Math.min(a, b) * PAIR_KEY_BASE + Math.max(a, b);
    const tally = border.get(key) ?? { river: 0, pixels: [] };
    tally.pixels.push(i);
    if (river[i] || river[j]) tally.river++;
    border.set(key, tally);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) count(i, i + 1);
      if (y + 1 < height) count(i, i + width);
    }
  const result: RiverBorders = { rivers: [], bridges: [] };
  for (const [key, { river: along, pixels }] of border) {
    const total = pixels.length;
    if (total < MIN_RIVER_BORDER || along < total * RIVER_SHARE) continue;
    const a = Math.floor(key / PAIR_KEY_BASE);
    const b = key % PAIR_KEY_BASE;
    result.rivers.push([a, b]);
    adjacency.get(a)!.delete(b);
    adjacency.get(b)!.delete(a);
    if (connected(adjacency, a, b)) continue;
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
    result.bridges.push(middlePixel(pixels, width));
  }
  return result;
}

function middlePixel(pixels: number[], width: number): number {
  const mx = pixels.reduce((sum, i) => sum + (i % width), 0) / pixels.length;
  const my =
    pixels.reduce((sum, i) => sum + Math.floor(i / width), 0) / pixels.length;
  const distance = (i: number) =>
    Math.hypot((i % width) - mx, Math.floor(i / width) - my);
  return pixels.reduce((best, i) => (distance(i) < distance(best) ? i : best));
}
