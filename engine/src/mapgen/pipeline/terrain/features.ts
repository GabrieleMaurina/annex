import { Fill } from '../../core/params';
import { MOUNTAIN_VOID, RANGE_VOID } from '../../render/gif';
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

export function terrainFeatures(
  land: Uint8Array,
  heights: Float32Array,
  fill: Fill,
  width: number,
  expectedTerritoryArea: number,
  toggles: TerrainToggles,
): Uint8Array {
  const voidMask = new Uint8Array(land.length);
  if (!toggles.mountains) return voidMask;
  addMountains(
    voidMask,
    land,
    heights,
    sortedHeights(heights, land),
    fill,
    width,
    expectedTerritoryArea * MOUNTAIN_AREA_RATIO,
  );
  return voidMask;
}
