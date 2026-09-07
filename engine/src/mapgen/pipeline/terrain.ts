import { Perlin2D } from '../core/noise';
import { Fill, FILL_THRESHOLDS, GridDimensions } from '../core/params';
import { Rng } from '../core/rng';

const PERSISTENCE = 0.44;
const LACUNARITY = 2;

const ISLAND_BORDER_FRACTION = 0.05;
const ISLAND_BORDER_DEPTH = 1.2;

function shouldCarveIslandBorder(rng: Rng, fill: Fill): boolean {
  if (fill === 'sparse') return true;
  if (fill === 'full') return false;
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

const TERRAIN_PARAMS: Record<Fill, { frequency: number; octaves: number }> = {
  full: { frequency: 7.2, octaves: 6 },
  mixed: { frequency: 3.2, octaves: 5 },
  sparse: { frequency: 6.5, octaves: 6 },
};

export function buildLandMask(
  rng: Rng,
  fill: Fill,
  dims: GridDimensions,
): Uint8Array {
  const perlin = new Perlin2D(rng);
  const threshold = FILL_THRESHOLDS[fill];
  const { frequency, octaves } = TERRAIN_PARAMS[fill];
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
  if (shouldCarveIslandBorder(rng, fill)) {
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
