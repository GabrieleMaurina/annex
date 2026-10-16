export interface RegionPoint {
  id: number;
  x: number;
  y: number;
  isSea?: boolean;
}

export interface RegionLabels {
  width: number;
  height: number;
  labels: Int16Array;
  wall: Uint8Array;
  invalidIds: Set<number>;
}

const BORDER_TOLERANCE = 16;
const WALL_MAX_ALPHA = 128;
const MAX_LAND_AREA_FRACTION = 0.1;
const MAX_SEA_AREA_FRACTION = 0.25;

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function wallMask(image: ImageData, borderColors: string[]): Uint8Array {
  const { data } = image;
  const colors = borderColors.map(rgbOf);
  const wall = new Uint8Array(image.width * image.height);
  for (let i = 0; i < wall.length; i++) {
    const o = i * 4;
    if (data[o + 3] < WALL_MAX_ALPHA) {
      wall[i] = 1;
      continue;
    }
    for (const [r, g, b] of colors) {
      if (
        Math.abs(data[o] - r) <= BORDER_TOLERANCE &&
        Math.abs(data[o + 1] - g) <= BORDER_TOLERANCE &&
        Math.abs(data[o + 2] - b) <= BORDER_TOLERANCE
      ) {
        wall[i] = 1;
        break;
      }
    }
  }
  return wall;
}

function flood(
  labels: Int16Array,
  wall: Uint8Array,
  width: number,
  stack: Int32Array,
  start: number,
  id: number,
): number {
  const size = labels.length;
  let top = 0;
  let area = 0;
  const visit = (q: number) => {
    if (wall[q] || labels[q] >= 0) return;
    labels[q] = id;
    stack[top++] = q;
    area++;
  };
  visit(start);
  while (top > 0) {
    const p = stack[--top];
    const x = p % width;
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p + width < size) visit(p + width);
  }
  return area;
}

export function labelRegions(
  image: ImageData,
  points: RegionPoint[],
  borderColors: string[],
): RegionLabels {
  const { width, height } = image;
  const wall = wallMask(image, borderColors);
  const labels = new Int16Array(width * height).fill(-1);
  const stack = new Int32Array(width * height);
  const invalidIds = new Set<number>();
  for (const point of points) {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      invalidIds.add(point.id);
      continue;
    }
    const start = y * width + x;
    const owner = labels[start];
    if (wall[start] || owner >= 0) {
      invalidIds.add(point.id);
      if (owner >= 0) invalidIds.add(owner);
      continue;
    }
    const maxArea =
      width *
      height *
      (point.isSea ? MAX_SEA_AREA_FRACTION : MAX_LAND_AREA_FRACTION);
    if (flood(labels, wall, width, stack, start, point.id) > maxArea)
      invalidIds.add(point.id);
  }
  return { width, height, labels, wall, invalidIds };
}
