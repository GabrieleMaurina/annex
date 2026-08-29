import { Perlin2D } from '../core/noise';
import { GridDimensions, WATER_THRESHOLDS, WaterLevel } from '../core/params';
import { Rng } from '../core/rng';

const PERSISTENCE = 0.5;
const LACUNARITY = 2;

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
): boolean[][] {
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
  const land: boolean[][] = [];
  for (let gy = 0; gy < gridHeight; gy++) {
    const row: boolean[] = [];
    for (let gx = 0; gx < width; gx++) {
      const normalized = (heights[gy][gx] - min) / range;
      row.push(normalized > threshold);
    }
    land.push(row);
  }
  return land;
}
