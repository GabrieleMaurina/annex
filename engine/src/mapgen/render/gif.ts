import { SpecialEdge } from '../pipeline/connectivity';
import { GridPoint } from '../pipeline/placement';
import { hexToRgb, paletteGif } from './encodeGif';
import {
  continentEarthTone,
  GREEN_LAND_COLOR,
  MOUNTAIN_RANGE_COLOR,
  PEAK_ROCK_COLOR,
  PEAK_ROCK_SHADE_COLOR,
  PEAK_SNOW_COLOR,
  PEAK_SNOW_SHADE_COLOR,
  RIVER_BORDER_COLOR,
  SEA_COLOR,
  TERRITORY_STROKE_COLOR,
  VOID_LAND_COLOR,
} from './palette';
import { drawPeaks } from './peaks';
import { repairSplitTerritories } from './splitRepair';

const BORDER_RADIUS = 2;
const DASH_ON = 8;
const DASH_PERIOD = 22;
const PAIR_KEY_BASE = 65536;
const BRIDGE_RADIUS = 7;

export const MOUNTAIN_VOID = 2;
export const GREEN_VOID = 3;
export const RANGE_VOID = 4;
export const WATER_VOID = 5;
export const RIVER_VOID = 6;

export interface SeaRenderLayer {
  seaLabelGrid: Int16Array;
  landCount: number;
}

export function renderTerrainImage(
  labelGrid: Int16Array,
  width: number,
  height: number,
  continentIdByTerritory: number[],
  centroids: GridPoint[],
  specialEdges: SpecialEdge[],
  seaLayer?: SeaRenderLayer,
  voidMask?: Uint8Array,
  riverPairs?: [number, number][],
  bridges?: number[],
): string {
  const { indices, palette } = rasterize(
    labelGrid,
    width,
    height,
    continentIdByTerritory,
    centroids,
    specialEdges,
    seaLayer,
    voidMask,
    riverPairs ?? [],
    bridges ?? [],
  );
  return paletteGif(width, height, indices, palette);
}

function rasterize(
  labelGrid: Int16Array,
  width: number,
  height: number,
  continentIdByTerritory: number[],
  centroids: GridPoint[],
  specialEdges: SpecialEdge[],
  seaLayer: SeaRenderLayer | undefined,
  voidMask: Uint8Array | undefined,
  riverPairs: [number, number][],
  bridges: number[],
): { indices: Uint8Array; palette: number[] } {
  const palette: number[] = [];
  const paletteOf = new Map<number, number>();
  const index = (rgb: number): number => {
    let i = paletteOf.get(rgb);
    if (i === undefined) {
      i = palette.length;
      palette.push(rgb);
      paletteOf.set(rgb, i);
    }
    return i;
  };

  const sea = index(hexToRgb(SEA_COLOR));
  const stroke = index(hexToRgb(TERRITORY_STROKE_COLOR));
  const territoryColor = continentIdByTerritory.map((c) =>
    index(hexToRgb(continentEarthTone(c))),
  );
  const voidColor = voidMask ? index(hexToRgb(VOID_LAND_COLOR)) : sea;
  const greenColor = voidMask ? index(hexToRgb(GREEN_LAND_COLOR)) : sea;
  const rangeColor = voidMask ? index(hexToRgb(MOUNTAIN_RANGE_COLOR)) : sea;
  const pairKey = (a: number, b: number) =>
    Math.min(a, b) * PAIR_KEY_BASE + Math.max(a, b);
  const riverKeys = new Set(riverPairs.map(([a, b]) => pairKey(a, b)));
  const hasRivers = !!voidMask?.includes(RIVER_VOID);
  const river =
    riverKeys.size > 0 || hasRivers
      ? index(hexToRgb(RIVER_BORDER_COLOR))
      : stroke;

  const size = width * height;
  const r = BORDER_RADIUS;

  const combinedLabel = seaLayer
    ? Int32Array.from(labelGrid, (label, i) =>
        label >= 0
          ? label
          : seaLayer.seaLabelGrid[i] >= 0
            ? seaLayer.landCount + seaLayer.seaLabelGrid[i]
            : -1,
      )
    : labelGrid;

  const thin = new Uint8Array(size);
  const riverThin =
    riverKeys.size > 0 || hasRivers ? new Uint8Array(size) : null;
  const isRiver = (i: number, j: number) =>
    labelGrid[i] !== labelGrid[j] &&
    ((labelGrid[i] >= 0 &&
      labelGrid[j] >= 0 &&
      riverKeys.has(pairKey(labelGrid[i], labelGrid[j]))) ||
      voidMask?.[i] === RIVER_VOID ||
      voidMask?.[j] === RIVER_VOID);
  for (let i = 0; i < size; i++) {
    const label = combinedLabel[i];
    const x = i % width;
    if (
      (x + 1 < width && combinedLabel[i + 1] !== label) ||
      (i + width < size && combinedLabel[i + width] !== label)
    )
      thin[i] = 1;
    if (
      riverThin &&
      ((x + 1 < width && isRiver(i, i + 1)) ||
        (i + width < size && isRiver(i, i + width)))
    )
      riverThin[i] = 1;
  }

  const seam = new Uint8Array(size);
  const riverSeam = riverThin ? new Uint8Array(size) : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!thin[y * width + x]) continue;
      const alongRiver = riverThin?.[y * width + x];
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          seam[ny * width + nx] = 1;
          if (alongRiver) riverSeam![ny * width + nx] = 1;
        }
      }
    }
  }
  for (const bridge of bridges) {
    const bx = bridge % width;
    const by = Math.floor(bridge / width);
    for (let dy = -BRIDGE_RADIUS; dy <= BRIDGE_RADIUS; dy++)
      for (let dx = -BRIDGE_RADIUS; dx <= BRIDGE_RADIUS; dx++) {
        const nx = bx + dx;
        const ny = by + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height)
          riverSeam![ny * width + nx] = 0;
      }
  }

  repairSplitTerritories(combinedLabel, seam, width, height);

  const indices = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const label = labelGrid[i];
    indices[i] = seam[i]
      ? riverSeam?.[i]
        ? river
        : stroke
      : label >= 0
        ? territoryColor[label]
        : voidMask?.[i] === MOUNTAIN_VOID || voidMask?.[i] === RANGE_VOID
          ? rangeColor
          : voidMask?.[i] === GREEN_VOID
            ? greenColor
            : voidMask?.[i] === RIVER_VOID
              ? river
              : voidMask?.[i] === WATER_VOID
                ? sea
                : voidMask?.[i]
                  ? voidColor
                  : sea;
  }
  if (voidMask)
    drawPeaks(
      indices,
      (i) =>
        (voidMask[i] === RANGE_VOID || voidMask[i] === MOUNTAIN_VOID) &&
        labelGrid[i] < 0 &&
        !seam[i],
      (i) => voidMask[i] === MOUNTAIN_VOID,
      width,
      height,
      {
        rock: index(hexToRgb(PEAK_ROCK_COLOR)),
        rockShade: index(hexToRgb(PEAK_ROCK_SHADE_COLOR)),
        snow: index(hexToRgb(PEAK_SNOW_COLOR)),
        snowShade: index(hexToRgb(PEAK_SNOW_SHADE_COLOR)),
      },
    );

  for (const { a, b } of specialEdges) {
    const from = centroids[a];
    const to = centroids[b];
    if (!from || !to) continue;
    const dx = to.gx - from.gx;
    const dy = to.gy - from.gy;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let s = 0; s <= steps; s++) {
      if (s % DASH_PERIOD >= DASH_ON) continue;
      const px = Math.round(from.gx + (dx * s) / steps);
      const py = Math.round(from.gy + (dy * s) / steps);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      if (labelGrid[py * width + px] >= 0) continue;
      for (let ey = -r; ey <= r; ey++) {
        const ny = py + ey;
        if (ny < 0 || ny >= height) continue;
        for (let ex = -r; ex <= r; ex++) {
          const nx = px + ex;
          if (nx >= 0 && nx < width) indices[ny * width + nx] = stroke;
        }
      }
    }
  }

  return { indices, palette };
}
