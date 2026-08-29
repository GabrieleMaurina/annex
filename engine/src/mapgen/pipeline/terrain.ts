import { Perlin2D } from '../core/noise';
import { GridDimensions, WATER_THRESHOLDS, WaterLevel } from '../core/params';
import { Rng } from '../core/rng';

const PERSISTENCE = 0.5;
const LACUNARITY = 2;

// 'land' and 'ocean' both threshold near an extreme of the height field, so
// the minority terrain (lakes in 'land', islands in 'ocean') is naturally
// fragmented into many small blobs rather than one sprawling body - but only
// if the noise itself has enough small-scale detail. A higher frequency and
// an extra octave give both modes that detail; 'mixed' sits near the middle
// of the range, where even coarse noise already breaks up into varied,
// contiguous-but-irregular landmasses, so it's left alone.
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
