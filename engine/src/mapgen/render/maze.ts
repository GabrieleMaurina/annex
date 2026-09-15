import { SpecialEdge } from '../pipeline/connectivity';
import { CellLayer } from '../pipeline/maze/cellLayer';
import { GridPoint } from '../pipeline/placement';
import { PaletteBuilder, paletteGif } from './encodeGif';
import { SEA_COLOR } from './palette';

export interface MazePalette {
  voidColor: string;
  wallColor: string;
  seamColor: string;
  tone: (continentId: number) => string;
  roundedWalls?: boolean;
}

const SPECIAL_EDGE_RADIUS = 2;
const DASH_ON = 8;
const DASH_PERIOD = 22;

export interface MazeConnectivity {
  centroids: GridPoint[];
  specialEdges: SpecialEdge[];
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

export interface MazeSeaLayer {
  pixelSea: Int16Array;
  seaCount: number;
  doors?: Map<number, Set<number>>;
}

export function computeWallSeamMasks(
  labelGrid: Int16Array,
  layer: CellLayer,
  roundedWalls: boolean,
  seaLayer?: MazeSeaLayer,
): { wallMask: Uint8Array; seamMask: Uint8Array } {
  const { width, height, cellCount, cellNeighbors, pixelCell } = layer;
  const size = width * height;
  const pixelSea = seaLayer?.pixelSea ?? null;
  const doors = seaLayer?.doors ?? null;

  let navigablePixels = 0;
  for (let i = 0; i < size; i++) if (pixelCell[i] >= 0) navigablePixels++;
  const cellPx = Math.sqrt(navigablePixels / Math.max(1, cellCount));
  const wallRadius = clamp(Math.round(cellPx * 0.13), 4, 16);
  const seamRadius = clamp(Math.round(cellPx * 0.035), 1, 5);

  const connected = new Set<number>();
  for (let a = 0; a < cellCount; a++) {
    for (const b of cellNeighbors[a]) {
      if (a < b) connected.add(a * cellCount + b);
    }
  }

  const wall = new Uint8Array(size);
  const seam = new Uint8Array(size);
  const doorCore = new Uint8Array(size);
  const consider = (i: number, j: number) => {
    const ca = pixelCell[i];
    const cb = pixelCell[j];
    const wa = pixelSea ? pixelSea[i] : -1;
    const wb = pixelSea ? pixelSea[j] : -1;
    if (ca === cb && wa === wb) return;

    if (ca >= 0 && cb >= 0) {
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
      return;
    }

    if (wa >= 0 || wb >= 0) {
      const bothSea = wa >= 0 && wb >= 0;
      const landId = ca >= 0 ? labelGrid[i] : cb >= 0 ? labelGrid[j] : -1;
      const seaId = wa >= 0 ? wa : wb;
      const isDoor =
        bothSea ||
        (landId >= 0 && (!doors || (doors.get(landId)?.has(seaId) ?? false)));
      if (isDoor) {
        seam[i] = 1;
        seam[j] = 1;
        doorCore[i] = 1;
        doorCore[j] = 1;
      } else {
        wall[i] = 1;
        wall[j] = 1;
      }
      return;
    }
    wall[i] = 1;
    wall[j] = 1;
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
  for (let i = 0; i < size; i++) {
    if (doorCore[i]) seam[i] = 1;
  }

  let wallMask = dilate(wall, width, height, wallRadius, roundedWalls);
  let seamMask = dilate(seam, width, height, seamRadius, roundedWalls);
  if (roundedWalls) {
    wallMask = smoothMask(wallMask, width, height);
    seamMask = smoothMask(seamMask, width, height);
  }

  return { wallMask, seamMask };
}

export function renderMazeImage(
  labelGrid: Int16Array,
  layer: CellLayer,
  continentIdByTerritory: number[],
  palette: MazePalette,
  seaLayer?: MazeSeaLayer,
  connectivity?: MazeConnectivity,
): string {
  const { width, height } = layer;
  const size = width * height;
  const pixelSea = seaLayer?.pixelSea ?? null;

  const builder = new PaletteBuilder();
  const voidIndex = builder.indexHex(palette.voidColor);
  const wallIndex = builder.indexHex(palette.wallColor);
  const seamIndex = builder.indexHex(palette.seamColor);
  const seaIndex = builder.indexHex(SEA_COLOR);
  const toneIndex = continentIdByTerritory.map((c) =>
    builder.indexHex(palette.tone(c)),
  );

  const { wallMask, seamMask } = computeWallSeamMasks(
    labelGrid,
    layer,
    palette.roundedWalls === true,
    seaLayer,
  );

  const indices = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    if (wallMask[i]) {
      indices[i] = wallIndex;
    } else if (seamMask[i]) {
      indices[i] = seamIndex;
    } else if (labelGrid[i] >= 0) {
      indices[i] = toneIndex[labelGrid[i]];
    } else if (pixelSea && pixelSea[i] >= 0) {
      indices[i] = seaIndex;
    } else {
      indices[i] = voidIndex;
    }
  }

  if (connectivity) {
    const { centroids, specialEdges } = connectivity;
    const r = SPECIAL_EDGE_RADIUS;
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
            if (nx < 0 || nx >= width) continue;
            const ni = ny * width + nx;
            if (wallMask[ni]) continue;
            indices[ni] = seamIndex;
          }
        }
      }
    }
  }

  return paletteGif(width, height, indices, builder.colors);
}
