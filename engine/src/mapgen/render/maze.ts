import { SpecialEdge } from '../pipeline/connectivity';
import { CellLayer } from '../pipeline/maze/cellLayer';
import { GridPoint } from '../pipeline/placement';
import { PaletteBuilder, paletteGif } from './encodeGif';
import { BORDER_THICKNESS, SEA_COLOR, SPECIAL_EDGE_RADIUS } from './palette';

export interface MazePalette {
  voidColor: string;
  wallColor: string;
  seamColor: string;
  tone: (continentId: number) => string;
  roundedWalls?: boolean;
  uniformLines?: boolean;
  continentWalls?: boolean;
  voidSeas?: boolean;
  seaColor?: string;
}

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
  palette: MazePalette,
  seaLayer?: MazeSeaLayer,
  continentOf?: number[],
): { wallMask: Uint8Array; seamMask: Uint8Array } {
  const roundedWalls = palette.roundedWalls === true;
  const { width, height, cellCount, cellNeighbors, pixelCell } = layer;
  const size = width * height;
  const pixelSea = seaLayer?.pixelSea ?? null;
  const doors = seaLayer?.doors ?? null;

  let navigablePixels = 0;
  for (let i = 0; i < size; i++) if (pixelCell[i] >= 0) navigablePixels++;
  const cellPx = Math.sqrt(navigablePixels / Math.max(1, cellCount));
  const seamRadius = (BORDER_THICKNESS - 1) / 2;
  const wallRadius = palette.uniformLines
    ? seamRadius
    : clamp(Math.round(cellPx * 0.13), 4, 16);

  const connected = new Set<number>();
  for (let a = 0; a < cellCount; a++) {
    for (const b of cellNeighbors[a]) {
      if (a < b) connected.add(a * cellCount + b);
    }
  }

  const wall = new Uint8Array(size);
  const seam = new Uint8Array(size);
  const doorCore = new Uint8Array(size);
  const markWall = (i: number, j: number) => {
    wall[i] = 1;
    if (!palette.uniformLines) wall[j] = 1;
  };
  const consider = (i: number, j: number) => {
    const ca = pixelCell[i];
    const cb = pixelCell[j];
    const wa = pixelSea ? pixelSea[i] : -1;
    const wb = pixelSea ? pixelSea[j] : -1;
    if (ca === cb && wa === wb) return;

    if (ca >= 0 && cb >= 0) {
      const key = ca < cb ? ca * cellCount + cb : cb * cellCount + ca;
      if (connected.has(key)) {
        if (
          continentOf &&
          continentOf[labelGrid[i]] !== continentOf[labelGrid[j]]
        ) {
          markWall(i, j);
        } else if (labelGrid[i] !== labelGrid[j]) {
          seam[i] = 1;
        }
      } else {
        markWall(i, j);
      }
      return;
    }

    if (wa >= 0 || wb >= 0) {
      const bothSea = wa >= 0 && wb >= 0;
      const landId = ca >= 0 ? labelGrid[i] : cb >= 0 ? labelGrid[j] : -1;
      if (palette.voidSeas && !bothSea && landId < 0) return;
      const seaId = wa >= 0 ? wa : wb;
      const isDoor =
        bothSea ||
        (!palette.voidSeas &&
          landId >= 0 &&
          (!doors || (doors.get(landId)?.has(seaId) ?? false)));
      if (isDoor) {
        seam[i] = 1;
        doorCore[i] = 1;
      } else {
        markWall(i, j);
      }
      return;
    }
    markWall(i, j);
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

const WALL_GAP_HALF_WIDTH = 12;
const WALL_NORMAL_WINDOW = 16;

interface Vector {
  x: number;
  y: number;
}

function directionTowards(
  labelGrid: Int16Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  isTarget: (label: number) => boolean,
): Vector | null {
  let sumX = 0;
  let sumY = 0;
  for (let dy = -WALL_NORMAL_WINDOW; dy <= WALL_NORMAL_WINDOW; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= height) continue;
    for (let dx = -WALL_NORMAL_WINDOW; dx <= WALL_NORMAL_WINDOW; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= width || !isTarget(labelGrid[y * width + x])) continue;
      sumX += dx;
      sumY += dy;
    }
  }
  const length = Math.hypot(sumX, sumY);
  return length > 0 ? { x: sumX / length, y: sumY / length } : null;
}

function normalOfWall(
  wallMask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
): Vector | null {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let dy = -WALL_NORMAL_WINDOW; dy <= WALL_NORMAL_WINDOW; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= height) continue;
    for (let dx = -WALL_NORMAL_WINDOW; dx <= WALL_NORMAL_WINDOW; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= width || !wallMask[y * width + x]) continue;
      count++;
      sumX += dx;
      sumY += dy;
      sumXX += dx * dx;
      sumYY += dy * dy;
      sumXY += dx * dy;
    }
  }
  if (count === 0) return null;
  const varianceX = sumXX / count - (sumX / count) ** 2;
  const varianceY = sumYY / count - (sumY / count) ** 2;
  const covariance = sumXY / count - (sumX / count) * (sumY / count);
  const axis = 0.5 * Math.atan2(2 * covariance, varianceX - varianceY);
  return { x: -Math.sin(axis), y: Math.cos(axis) };
}

interface WallGrid {
  wallMask: Uint8Array;
  decorative: Uint8Array;
  labelGrid: Int16Array;
  width: number;
  height: number;
}

interface WallRun {
  start: number;
  end: number;
}

interface GapPlacement {
  cx: number;
  cy: number;
  normal: Vector;
  halfDepth: number;
}

function edgeLine(
  from: GridPoint,
  to: GridPoint,
  width: number,
  height: number,
): { pixels: number[]; direction: Vector } {
  const dx = to.gx - from.gx;
  const dy = to.gy - from.gy;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  const pixels = Array.from({ length: steps + 1 }, (_, s) => {
    const px = Math.round(from.gx + (dx * s) / steps);
    const py = Math.round(from.gy + (dy * s) / steps);
    const inside = px >= 0 && px < width && py >= 0 && py < height;
    return inside ? py * width + px : -1;
  });
  return { pixels, direction: { x: dx / steps, y: dy / steps } };
}

function wallRuns(pixels: number[], wallMask: Uint8Array): WallRun[] {
  const isWall = (pixel: number) => pixel >= 0 && wallMask[pixel] !== 0;
  const runs: WallRun[] = [];
  for (let i = 0; i < pixels.length; i++) {
    if (!isWall(pixels[i])) continue;
    const start = i;
    while (i + 1 < pixels.length && isWall(pixels[i + 1])) i++;
    runs.push({ start, end: i });
  }
  return runs;
}

function gapPlacement(
  grid: WallGrid,
  pixels: number[],
  run: WallRun,
  lineDirection: Vector,
  isOwner: (label: number) => boolean,
): GapPlacement | null {
  const { wallMask, decorative, labelGrid, width, height } = grid;
  const before = run.start > 0 ? pixels[run.start - 1] : -1;
  const after = run.end + 1 < pixels.length ? pixels[run.end + 1] : -1;
  if (before < 0 || after < 0) return null;

  const labelBefore = labelGrid[before];
  const labelAfter = labelGrid[after];
  const isOpenEnd = (label: number) => label < 0 || isOwner(label);
  const crossesDecoration =
    isOpenEnd(labelBefore) &&
    isOpenEnd(labelAfter) &&
    pixels.slice(run.start, run.end + 1).some((p) => decorative[p] === 1);
  const insideVoid = labelBefore < 0 && labelAfter < 0;
  const separatesOwnerFromVoid =
    (isOwner(labelBefore) && labelAfter < 0) ||
    (labelBefore < 0 && isOwner(labelAfter));
  if (!crossesDecoration && !insideVoid && !separatesOwnerFromVoid) return null;

  const middle = pixels[(run.start + run.end) >> 1];
  const cx = middle % width;
  const cy = (middle / width) | 0;
  const normal = crossesDecoration
    ? lineDirection
    : ((insideVoid
        ? normalOfWall(wallMask, width, height, cx, cy)
        : directionTowards(labelGrid, width, height, cx, cy, isOwner)) ??
      lineDirection);
  return {
    cx,
    cy,
    normal,
    halfDepth: Math.ceil((run.end - run.start + 1) / 2) + 2,
  };
}

function markGap(
  gap: Uint8Array,
  grid: WallGrid,
  { cx, cy, normal, halfDepth }: GapPlacement,
  isOwner: (label: number) => boolean,
): void {
  const { labelGrid, width, height } = grid;
  const reach = Math.ceil(Math.hypot(halfDepth, WALL_GAP_HALF_WIDTH));
  for (let oy = -reach; oy <= reach; oy++) {
    const ny = cy + oy;
    if (ny < 0 || ny >= height) continue;
    for (let ox = -reach; ox <= reach; ox++) {
      const nx = cx + ox;
      if (nx < 0 || nx >= width) continue;
      const depth = ox * normal.x + oy * normal.y;
      const along = -ox * normal.y + oy * normal.x;
      if (
        Math.abs(depth) > halfDepth ||
        Math.abs(along) > WALL_GAP_HALF_WIDTH
      ) {
        continue;
      }
      const ni = ny * width + nx;
      const label = labelGrid[ni];
      if (label >= 0 && !isOwner(label)) continue;
      gap[ni] = 1;
    }
  }
}

function clearGaps(
  gap: Uint8Array,
  grid: WallGrid,
  seamMask: Uint8Array,
  roundedWalls: boolean,
): void {
  const { wallMask, labelGrid, width, height } = grid;
  const boundary = new Uint8Array(gap.length);
  for (let i = 0; i < gap.length; i++) {
    if (!gap[i] || labelGrid[i] < 0) continue;
    const x = i % width;
    const y = (i / width) | 0;
    if (
      (x > 0 && labelGrid[i - 1] < 0) ||
      (x + 1 < width && labelGrid[i + 1] < 0) ||
      (y > 0 && labelGrid[i - width] < 0) ||
      (y + 1 < height && labelGrid[i + width] < 0)
    ) {
      boundary[i] = 1;
    }
  }
  const border = dilate(
    boundary,
    width,
    height,
    (BORDER_THICKNESS - 1) / 2,
    roundedWalls,
  );
  for (let i = 0; i < gap.length; i++) {
    if (!gap[i]) continue;
    wallMask[i] = 0;
    if (border[i]) seamMask[i] = 1;
  }
}

function openWallsAlongSpecialEdges(
  wallMask: Uint8Array,
  seamMask: Uint8Array,
  labelGrid: Int16Array,
  decorative: Uint8Array,
  width: number,
  height: number,
  connectivity: MazeConnectivity,
  roundedWalls: boolean,
): void {
  const { centroids, specialEdges } = connectivity;
  const grid = { wallMask, decorative, labelGrid, width, height };
  const gap = new Uint8Array(wallMask.length);

  for (const { a, b } of specialEdges) {
    const from = centroids[a];
    const to = centroids[b];
    if (!from || !to) continue;
    const { pixels, direction } = edgeLine(from, to, width, height);
    const isOwner = (label: number) => label === a || label === b;
    for (const run of wallRuns(pixels, wallMask)) {
      const placement = gapPlacement(grid, pixels, run, direction, isOwner);
      if (placement) markGap(gap, grid, placement, isOwner);
    }
  }

  clearGaps(gap, grid, seamMask, roundedWalls);
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
  const seaIndex = builder.indexHex(palette.seaColor ?? SEA_COLOR);
  const toneIndex = continentIdByTerritory.map((c) =>
    builder.indexHex(palette.tone(c)),
  );

  const { wallMask, seamMask } = computeWallSeamMasks(
    labelGrid,
    layer,
    palette,
    seaLayer,
    palette.continentWalls ? continentIdByTerritory : undefined,
  );

  const decorative = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    if (layer.pixelCell[i] < 0 || labelGrid[i] >= 0) continue;
    if (pixelSea && pixelSea[i] >= 0) continue;
    decorative[i] = 1;
    wallMask[i] = 1;
  }

  if (connectivity) {
    openWallsAlongSpecialEdges(
      wallMask,
      seamMask,
      labelGrid,
      decorative,
      width,
      height,
      connectivity,
      palette.roundedWalls === true,
    );
  }

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
