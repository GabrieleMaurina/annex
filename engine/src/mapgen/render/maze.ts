import { CellLayer } from '../pipeline/maze/cellLayer';
import { PaletteBuilder, paletteGif } from './encodeGif';

export interface MazePalette {
  voidColor: string;
  wallColor: string;
  seamColor: string;
  tone: (continentId: number) => string;
  roundedWalls?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function removeSpecks(
  mask: Uint8Array,
  width: number,
  height: number,
  minSize: number,
): void {
  const visited = new Uint8Array(mask.length);
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;
    const component: number[] = [start];
    while (stack.length > 0) {
      const p = stack.pop()!;
      const px = p % width;
      const py = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
          const np = ny * width + nx;
          if (mask[np] && !visited[np]) {
            visited[np] = 1;
            stack.push(np);
            component.push(np);
          }
        }
      }
    }
    if (component.length < minSize) {
      for (const p of component) mask[p] = 0;
    }
  }
}

function stampOffsets(radius: number, round: boolean): number[] {
  const offsets: number[] = [];
  const limit = round ? (radius + 0.5) * (radius + 0.5) : Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= limit) offsets.push(dx, dy);
    }
  }
  return offsets;
}

function dilate(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  round: boolean,
): Uint8Array {
  const out = new Uint8Array(mask.length);
  const offsets = stampOffsets(radius, round);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let k = 0; k < offsets.length; k += 2) {
        const ny = y + offsets[k + 1];
        if (ny < 0 || ny >= height) continue;
        const nx = x + offsets[k];
        if (nx >= 0 && nx < width) out[ny * width + nx] = 1;
      }
    }
  }
  return out;
}

function smoothMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width && mask[ny * width + nx]) count++;
        }
      }
      out[y * width + x] = count >= 5 ? 1 : 0;
    }
  }
  return out;
}

export function renderMazeImage(
  labelGrid: Int16Array,
  layer: CellLayer,
  continentIdByTerritory: number[],
  palette: MazePalette,
): string {
  const { width, height, cellCount, cellNeighbors, pixelCell } = layer;
  const size = width * height;

  let navigablePixels = 0;
  for (let i = 0; i < size; i++) if (pixelCell[i] >= 0) navigablePixels++;
  const cellPx = Math.sqrt(navigablePixels / Math.max(1, cellCount));
  const wallRadius = clamp(Math.round(cellPx * 0.13), 4, 16);
  const seamRadius = clamp(Math.round(cellPx * 0.035), 1, 5);

  const builder = new PaletteBuilder();
  const voidIndex = builder.indexHex(palette.voidColor);
  const wallIndex = builder.indexHex(palette.wallColor);
  const seamIndex = builder.indexHex(palette.seamColor);
  const toneIndex = continentIdByTerritory.map((c) =>
    builder.indexHex(palette.tone(c)),
  );

  const connected = new Set<number>();
  for (let a = 0; a < cellCount; a++) {
    for (const b of cellNeighbors[a]) {
      if (a < b) connected.add(a * cellCount + b);
    }
  }

  const wall = new Uint8Array(size);
  const seam = new Uint8Array(size);
  const consider = (i: number, j: number) => {
    const ca = pixelCell[i];
    const cb = pixelCell[j];
    if (ca === cb) return;
    if (ca < 0 || cb < 0) {
      wall[i] = 1;
      wall[j] = 1;
      return;
    }
    const key = ca < cb ? ca * cellCount + cb : cb * cellCount + ca;
    if (connected.has(key)) {
      if (labelGrid[i] !== labelGrid[j]) {
        seam[i] = 1;
        seam[j] = 1;
      }
    } else {
      wall[i] = 1;
      wall[j] = 1;
    }
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) consider(i, i + 1);
      if (y + 1 < height) consider(i, i + width);
    }
  }

  const minWallRun = Math.max(6, Math.round(cellPx * 0.35));
  removeSpecks(wall, width, height, minWallRun);
  removeSpecks(seam, width, height, minWallRun);

  const round = palette.roundedWalls === true;
  let wallMask = dilate(wall, width, height, wallRadius, round);
  let seamMask = dilate(seam, width, height, seamRadius, round);
  if (round) {
    wallMask = smoothMask(wallMask, width, height);
    seamMask = smoothMask(seamMask, width, height);
  }

  const indices = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    if (wallMask[i]) {
      indices[i] = wallIndex;
    } else if (seamMask[i]) {
      indices[i] = seamIndex;
    } else if (labelGrid[i] < 0) {
      indices[i] = voidIndex;
    } else {
      indices[i] = toneIndex[labelGrid[i]];
    }
  }

  return paletteGif(width, height, indices, builder.colors);
}
