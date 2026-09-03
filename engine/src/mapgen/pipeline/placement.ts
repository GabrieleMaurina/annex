import { randomInt, Rng } from '../core/rng';

export interface GridPoint {
  gx: number;
  gy: number;
}

export function placeTerritoryCenters(
  rng: Rng,
  land: Uint8Array,
  width: number,
  height: number,
  targetCount: number,
): GridPoint[] {
  const landCells: GridPoint[] = [];
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (land[gy * width + gx]) landCells.push({ gx, gy });
    }
  }
  if (landCells.length === 0) return [];

  const idealSpacing = Math.sqrt(landCells.length / targetCount) * 0.8;
  const centers: GridPoint[] = [];
  let spacing = idealSpacing;

  while (centers.length < targetCount && spacing > 0.5) {
    const attempts = targetCount * 30;
    for (
      let attempt = 0;
      attempt < attempts && centers.length < targetCount;
      attempt++
    ) {
      const candidate = landCells[randomInt(rng, 0, landCells.length - 1)];
      const farEnough = centers.every(
        (c) => Math.hypot(c.gx - candidate.gx, c.gy - candidate.gy) >= spacing,
      );
      if (farEnough) centers.push(candidate);
    }
    spacing *= 0.85;
  }

  return centers;
}
