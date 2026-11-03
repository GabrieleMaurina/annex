import { OsmFeatures, OsmWater } from '../types';
import { fillRings } from './rasterize';
import { smoothCoast } from './smooth';

const MOUNTAIN_CLASSES = ['rock', 'ice'];
const GREEN_CLASSES = ['wood', 'grass', 'farmland', 'wetland'];

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

export function carveLargeAreas(
  land: Uint8Array,
  areas: Uint8Array,
  width: number,
  minArea: number,
): void {
  const seen = new Uint8Array(areas.length);
  const stack: number[] = [];
  for (let start = 0; start < areas.length; start++) {
    if (!areas[start] || seen[start]) continue;
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
        if (n >= 0 && n < areas.length && areas[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
    }
    if (cells.length >= minArea) for (const c of cells) land[c] = 0;
  }
}

export function greenMask(
  features: OsmFeatures,
  width: number,
  height: number,
): Uint8Array {
  return areaMask(features.landcover, GREEN_CLASSES, width, height);
}

export function largeLandAreas(
  areas: Uint8Array,
  land: Uint8Array,
  width: number,
  minArea: number,
): Uint8Array {
  const kept = land.slice();
  carveLargeAreas(
    kept,
    Uint8Array.from(areas, (inside, i) => inside & land[i]),
    width,
    minArea,
  );
  return Uint8Array.from(land, (inside, i) => (inside && !kept[i] ? 1 : 0));
}
