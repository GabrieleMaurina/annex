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
export const MAX_LAND_AREA_FRACTION = 0.1;
const MAX_SEA_AREA_FRACTION = 0.4;

export function rgbOf(hex: string): [number, number, number] {
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
  labels: Int16Array | Int32Array,
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

function wallDistance(
  wall: Uint8Array,
  width: number,
  height: number,
): Int32Array {
  const dist = new Int32Array(wall.length);
  const edge = (p: number) => {
    if (!wall[p]) dist[p] = 3;
  };
  for (let x = 0; x < width; x++) {
    edge(x);
    edge((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    edge(y * width);
    edge(y * width + width - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    const end = y * width + width - 1;
    for (let p = y * width + 1; p < end; p++) {
      if (wall[p]) continue;
      dist[p] = Math.min(
        dist[p - 1] + 3,
        dist[p - width] + 3,
        dist[p - width - 1] + 4,
        dist[p - width + 1] + 4,
      );
    }
  }
  for (let y = height - 2; y >= 1; y--) {
    const start = y * width;
    for (let p = start + width - 2; p > start; p--) {
      if (wall[p]) continue;
      dist[p] = Math.min(
        dist[p],
        dist[p + 1] + 3,
        dist[p + width] + 3,
        dist[p + width + 1] + 4,
        dist[p + width - 1] + 4,
      );
    }
  }
  return dist;
}

export function findUnmarkedRegions(
  image: ImageData,
  points: RegionPoint[],
  borderColors: string[],
  isSea: boolean,
  minArea: number,
): { x: number; y: number }[] {
  const { width, height } = image;
  const wall = wallMask(image, borderColors);
  const labels = new Int32Array(width * height).fill(-1);
  const stack = new Int32Array(width * height);
  const areas: number[] = [];
  for (let p = 0; p < labels.length; p++)
    if (!wall[p] && labels[p] < 0)
      areas.push(flood(labels, wall, width, stack, p, areas.length));

  const maxArea =
    width * height * (isSea ? MAX_SEA_AREA_FRACTION : MAX_LAND_AREA_FRACTION);
  const eligible = new Uint8Array(areas.length);
  areas.forEach((area, id) => {
    if (area >= minArea && area <= maxArea) eligible[id] = 1;
  });
  for (const point of points) {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const id = labels[y * width + x];
    if (id >= 0) eligible[id] = 0;
  }

  const dist = wallDistance(wall, width, height);
  const deepest = new Int32Array(areas.length).fill(-1);
  for (let p = 0; p < labels.length; p++) {
    const id = labels[p];
    if (id < 0 || !eligible[id]) continue;
    const best = deepest[id];
    if (best < 0 || dist[p] > dist[best]) deepest[id] = p;
  }
  const found: { x: number; y: number }[] = [];
  for (const p of deepest)
    if (p >= 0)
      found.push({ x: (p % width) + 0.5, y: Math.floor(p / width) + 0.5 });
  return found;
}
