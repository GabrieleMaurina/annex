import { Perlin2D } from '../../core/noise';
import { OUTPUT_SCALE } from '../../core/params';
import { GridPoint } from '../placement';

const SEA_WARP_FREQUENCY_1 = 0.01 / OUTPUT_SCALE;
const SEA_WARP_AMPLITUDE_1 = 35 * OUTPUT_SCALE;
const SEA_WARP_FREQUENCY_2 = 0.03 / OUTPUT_SCALE;
const SEA_WARP_AMPLITUDE_2 = 12 * OUTPUT_SCALE;

export interface SeaWarp {
  warpX: Perlin2D;
  warpY: Perlin2D;
}

export function warpedPoint(
  warp: SeaWarp | null,
  px: number,
  py: number,
): GridPoint {
  if (!warp) return { gx: px, gy: py };
  return {
    gx:
      px +
      warp.warpX.noise(px * SEA_WARP_FREQUENCY_1, py * SEA_WARP_FREQUENCY_1) *
        SEA_WARP_AMPLITUDE_1 +
      warp.warpX.noise(px * SEA_WARP_FREQUENCY_2, py * SEA_WARP_FREQUENCY_2) *
        SEA_WARP_AMPLITUDE_2,
    gy:
      py +
      warp.warpY.noise(px * SEA_WARP_FREQUENCY_1, py * SEA_WARP_FREQUENCY_1) *
        SEA_WARP_AMPLITUDE_1 +
      warp.warpY.noise(px * SEA_WARP_FREQUENCY_2, py * SEA_WARP_FREQUENCY_2) *
        SEA_WARP_AMPLITUDE_2,
  };
}
