import type { ClickableRegions } from '../../../regions/clickableRegions';
import type { Point } from '../../helpers';

const STEP = 3;
const DIAGONAL = 4;
const SHIP_LENGTHS_OF_PADDING = 2.6;
const NARROW_SEA_SHARE = 0.8;

interface Clearance {
  left: number;
  top: number;
  width: number;
  height: number;
  distance: Int32Array;
  widest: number;
}

const clearanceByRegions = new WeakMap<
  ClickableRegions,
  Map<number, Clearance | null>
>();

function seaBounds(regions: ClickableRegions, seaId: number) {
  const { width, height, labels } = regions;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (labels[y * width + x] !== seaId) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  return right < 0 ? null : { left, top, right, bottom };
}

function computeClearance(
  regions: ClickableRegions,
  seaId: number,
): Clearance | null {
  const bounds = seaBounds(regions, seaId);
  if (!bounds) return null;
  const left = bounds.left - 1;
  const top = bounds.top - 1;
  const width = bounds.right - bounds.left + 3;
  const height = bounds.bottom - bounds.top + 3;
  const distance = new Int32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const sx = left + x;
      const sy = top + y;
      const inside =
        sx >= 0 &&
        sy >= 0 &&
        sx < regions.width &&
        sy < regions.height &&
        regions.labels[sy * regions.width + sx] === seaId;
      distance[y * width + x] = inside ? 1 << 29 : 0;
    }
  const relax = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    cost: number,
  ) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    const candidate = distance[ny * width + nx] + cost;
    if (candidate < distance[y * width + x])
      distance[y * width + x] = candidate;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      relax(x, y, -1, 0, STEP);
      relax(x, y, 0, -1, STEP);
      relax(x, y, -1, -1, DIAGONAL);
      relax(x, y, 1, -1, DIAGONAL);
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      relax(x, y, 1, 0, STEP);
      relax(x, y, 0, 1, STEP);
      relax(x, y, 1, 1, DIAGONAL);
      relax(x, y, -1, 1, DIAGONAL);
    }
  let widest = 0;
  for (let i = 0; i < distance.length; i++)
    if (distance[i] > widest) widest = distance[i];
  return { left, top, width, height, distance, widest };
}

function clearanceOf(regions: ClickableRegions, seaId: number) {
  let bySea = clearanceByRegions.get(regions);
  if (!bySea) {
    bySea = new Map();
    clearanceByRegions.set(regions, bySea);
  }
  if (!bySea.has(seaId)) bySea.set(seaId, computeClearance(regions, seaId));
  return bySea.get(seaId) ?? null;
}

export function paddedSeaPoint(
  regions: ClickableRegions,
  seaId: number,
  target: Point,
): Point | null {
  const clearance = clearanceOf(regions, seaId);
  if (!clearance) return null;
  const { left, top, width, height, distance, widest } = clearance;
  const padding =
    (Math.max(regions.width, regions.height) / 100) *
    SHIP_LENGTHS_OF_PADDING *
    STEP;
  const required =
    widest >= padding ? padding : Math.ceil(widest * NARROW_SEA_SHARE);
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (distance[y * width + x] < required || distance[y * width + x] === 0)
        continue;
      const px = left + x;
      const py = top + y;
      const d = (px - target.x) ** 2 + (py - target.y) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = { x: px, y: py };
      }
    }
  return best;
}
