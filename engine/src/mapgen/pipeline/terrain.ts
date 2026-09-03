import { Perlin2D } from '../core/noise';
import { GridDimensions, WATER_THRESHOLDS, WaterLevel } from '../core/params';
import { Rng } from '../core/rng';

const PERSISTENCE = 0.44;
const LACUNARITY = 2;

const ISLAND_BORDER_FRACTION = 0.05;
const ISLAND_BORDER_DEPTH = 1.2;

function shouldCarveIslandBorder(rng: Rng, water: WaterLevel): boolean {
  if (water === 'ocean') return true;
  if (water === 'land') return false;
  return rng() < 0.5;
}

function carveIslandBorder(
  heights: number[][],
  dims: GridDimensions,
  min: number,
  range: number,
): void {
  const { width, height: gridHeight } = dims;
  const ring = Math.max(
    2,
    Math.round(Math.min(width, gridHeight) * ISLAND_BORDER_FRACTION),
  );
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const edge = Math.min(gx, gy, width - 1 - gx, gridHeight - 1 - gy);
      if (edge >= ring) continue;
      const t = 1 - edge / ring;
      const carved = heights[gy][gx] - range * ISLAND_BORDER_DEPTH * t * t;
      heights[gy][gx] = Math.max(min, carved);
    }
  }
}

const TERRAIN_PARAMS: Record<
  WaterLevel,
  { frequency: number; octaves: number }
> = {
  land: { frequency: 7.2, octaves: 6 },
  mixed: { frequency: 3.2, octaves: 5 },
  ocean: { frequency: 6.5, octaves: 6 },
};

export function buildLandMask(
  rng: Rng,
  water: WaterLevel,
  dims: GridDimensions,
): Uint8Array {
  const perlin = new Perlin2D(rng);
  const threshold = WATER_THRESHOLDS[water];
  const { frequency, octaves } = TERRAIN_PARAMS[water];
  const { width, height: gridHeight } = dims;

  let min = Infinity;
  let max = -Infinity;
  const heights: number[][] = [];
  for (let gy = 0; gy < gridHeight; gy++) {
    const row: number[] = [];
    for (let gx = 0; gx < width; gx++) {
      const nx = (gx / width) * frequency;
      const ny = (gy / gridHeight) * frequency;
      const height = perlin.fbm(nx, ny, octaves, PERSISTENCE, LACUNARITY);
      row.push(height);
      if (height < min) min = height;
      if (height > max) max = height;
    }
    heights.push(row);
  }

  const range = max - min || 1;
  if (shouldCarveIslandBorder(rng, water)) {
    carveIslandBorder(heights, dims, min, range);
  }
  const land = new Uint8Array(width * gridHeight);
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if ((heights[gy][gx] - min) / range > threshold)
        land[gy * width + gx] = 1;
    }
  }
  return land;
}
