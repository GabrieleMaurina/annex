import { Perlin2D } from './noise';
import { OUTPUT_SCALE } from './params';
import { Rng } from './rng';

const WARP_SCALE = 0.7;
const WARP_FREQUENCY_1 = 0.035 / OUTPUT_SCALE;
const WARP_AMPLITUDE_1 = 9 * OUTPUT_SCALE * WARP_SCALE;
const WARP_FREQUENCY_2 = 0.12 / OUTPUT_SCALE;
const WARP_AMPLITUDE_2 = 3.5 * OUTPUT_SCALE * WARP_SCALE;
const WARP_STEP = 8;

export interface WarpField {
  dx: Float32Array;
  dy: Float32Array;
  cols: number;
}

export function createWarpField(
  rng: Rng,
  width: number,
  height: number,
): WarpField {
  const warpX = new Perlin2D(rng);
  const warpY = new Perlin2D(rng);
  const cols = Math.ceil(width / WARP_STEP) + 2;
  const rows = Math.ceil(height / WARP_STEP) + 2;
  const dx = new Float32Array(cols * rows);
  const dy = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const sy = j * WARP_STEP;
    for (let i = 0; i < cols; i++) {
      const sx = i * WARP_STEP;
      dx[j * cols + i] =
        warpX.noise(sx * WARP_FREQUENCY_1, sy * WARP_FREQUENCY_1) *
          WARP_AMPLITUDE_1 +
        warpX.noise(sx * WARP_FREQUENCY_2, sy * WARP_FREQUENCY_2) *
          WARP_AMPLITUDE_2;
      dy[j * cols + i] =
        warpY.noise(sx * WARP_FREQUENCY_1, sy * WARP_FREQUENCY_1) *
          WARP_AMPLITUDE_1 +
        warpY.noise(sx * WARP_FREQUENCY_2, sy * WARP_FREQUENCY_2) *
          WARP_AMPLITUDE_2;
    }
  }
  return { dx, dy, cols };
}

export function warpAt(
  field: WarpField,
  gx: number,
  gy: number,
  out: { x: number; y: number },
): void {
  const { dx, dy, cols } = field;
  const fy = gy / WARP_STEP;
  const j0 = fy | 0;
  const ty = fy - j0;
  const fx = gx / WARP_STEP;
  const i0 = fx | 0;
  const tx = fx - i0;
  const k = j0 * cols + i0;
  const dxT = dx[k] + (dx[k + 1] - dx[k]) * tx;
  const dxB = dx[k + cols] + (dx[k + cols + 1] - dx[k + cols]) * tx;
  const dyT = dy[k] + (dy[k + 1] - dy[k]) * tx;
  const dyB = dy[k + cols] + (dy[k + cols + 1] - dy[k + cols]) * tx;
  out.x = gx + dxT + (dxB - dxT) * ty;
  out.y = gy + dyT + (dyB - dyT) * ty;
}
