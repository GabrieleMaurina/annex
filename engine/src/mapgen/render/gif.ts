import { SpecialEdge } from '../pipeline/connectivity';
import { GridPoint } from '../pipeline/placement';
import { hexToRgb, paletteGif } from './encodeGif';
import {
  continentEarthTone,
  SEA_COLOR,
  TERRITORY_STROKE_COLOR,
} from './palette';

const BORDER_RADIUS = 2;
const DASH_ON = 8;
const DASH_PERIOD = 22;

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
): string {
  const { indices, palette } = rasterize(
    labelGrid,
    width,
    height,
    continentIdByTerritory,
    centroids,
    specialEdges,
    seaLayer,
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
  for (let i = 0; i < size; i++) {
    const label = combinedLabel[i];
    const x = i % width;
    if (
      (x + 1 < width && combinedLabel[i + 1] !== label) ||
      (i + width < size && combinedLabel[i + width] !== label)
    )
      thin[i] = 1;
  }

  const seam = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!thin[y * width + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) seam[ny * width + nx] = 1;
        }
      }
    }
  }

  const indices = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const label = labelGrid[i];
    indices[i] = seam[i] ? stroke : label < 0 ? sea : territoryColor[label];
  }

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
