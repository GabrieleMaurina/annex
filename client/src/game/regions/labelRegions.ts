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
const GAP_PER_LONGEST_SIDE = 1 / 160;
const MIN_GAP = 5;
const POCKET_GAPS = 2;

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

function pixelOf(point: RegionPoint, width: number, height: number): number {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  return x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x;
}

function maxAreaOf(point: RegionPoint, width: number, height: number): number {
  return (
    width *
    height *
    (point.isSea ? MAX_SEA_AREA_FRACTION : MAX_LAND_AREA_FRACTION)
  );
}

function closingGap(width: number, height: number): number {
  return Math.max(MIN_GAP, Math.max(width, height) * GAP_PER_LONGEST_SIDE);
}

function closedRegions(
  wall: Uint8Array,
  width: number,
  height: number,
  stack: Int32Array,
): { closed: Int32Array; count: number } {
  const reach = 3 * Math.ceil(closingGap(width, height) / 2);
  const dist = wallDistance(wall, width, height);
  const size = wall.length;
  const narrow = new Uint8Array(size);
  for (let p = 0; p < size; p++) if (dist[p] <= reach) narrow[p] = 1;
  const closed = new Int32Array(size).fill(-1);
  let count = 0;
  for (let p = 0; p < size; p++)
    if (!narrow[p] && closed[p] < 0)
      flood(closed, narrow, width, stack, p, count++);

  let tail = 0;
  for (let p = 0; p < size; p++) if (closed[p] >= 0) stack[tail++] = p;
  let label = -1;
  const claim = (q: number) => {
    if (wall[q] || closed[q] >= 0) return;
    closed[q] = label;
    stack[tail++] = q;
  };
  for (let head = 0; head < tail; head++) {
    const p = stack[head];
    label = closed[p];
    const x = p % width;
    if (x > 0) claim(p - 1);
    if (x < width - 1) claim(p + 1);
    if (p >= width) claim(p - width);
    if (p + width < size) claim(p + width);
  }
  return { closed, count };
}

function closeGaps(
  labels: Int16Array,
  wall: Uint8Array,
  width: number,
  height: number,
  stack: Int32Array,
  leaked: RegionPoint[],
  invalidIds: Set<number>,
) {
  const { closed, count } = closedRegions(wall, width, height, stack);
  const area = new Int32Array(count);
  for (const c of closed) if (c >= 0) area[c]++;
  const owner = new Int32Array(count).fill(-1);
  const rejected = new Uint8Array(count);
  for (const point of leaked) {
    const c = closed[pixelOf(point, width, height)];
    if (c < 0) continue;
    if (owner[c] >= 0 || area[c] > maxAreaOf(point, width, height))
      rejected[c] = 1;
    owner[c] = point.id;
  }
  for (let p = 0; p < labels.length; p++)
    if (invalidIds.has(labels[p]) && closed[p] >= 0)
      labels[p] = owner[closed[p]];
  for (let c = 0; c < count; c++)
    if (owner[c] >= 0 && !rejected[c]) invalidIds.delete(owner[c]);
}

function nearestLabel(
  labels: Int16Array,
  wall: Uint8Array,
  width: number,
  seen: Int32Array,
  stamp: number,
  pocket: Int32Array,
  reach: number,
): number {
  const size = labels.length;
  let found = -1;
  let frontier = Array.from(pocket);
  const visit = (q: number, next: number[]) => {
    if (labels[q] >= 0) found = labels[q];
    if (!wall[q] || seen[q] === stamp) return;
    seen[q] = stamp;
    next.push(q);
  };
  for (let step = 0; step < reach && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      if (x > 0) visit(p - 1, next);
      if (x < width - 1) visit(p + 1, next);
      if (p >= width) visit(p - width, next);
      if (p + width < size) visit(p + width, next);
      if (found >= 0) return found;
    }
    frontier = next;
  }
  return -1;
}

function absorbPockets(
  labels: Int16Array,
  wall: Uint8Array,
  width: number,
  height: number,
  queue: Int32Array,
) {
  const size = labels.length;
  const gap = closingGap(width, height);
  const maxArea = (POCKET_GAPS * gap) ** 2;
  const seen = new Int32Array(size).fill(-1);
  for (let start = 0; start < size; start++) {
    if (wall[start] || labels[start] >= 0 || seen[start] >= 0) continue;
    let tail = 0;
    let enclosed = true;
    seen[start] = start;
    queue[tail++] = start;
    const visit = (q: number) => {
      if (wall[q] || labels[q] >= 0 || seen[q] >= 0) return;
      seen[q] = start;
      queue[tail++] = q;
    };
    for (let head = 0; head < tail; head++) {
      const p = queue[head];
      const x = p % width;
      if (x === 0 || x === width - 1 || p < width || p + width >= size)
        enclosed = false;
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p + width < size) visit(p + width);
    }
    if (!enclosed || tail > maxArea) continue;
    const pocket = queue.subarray(0, tail);
    const owner = nearestLabel(labels, wall, width, seen, start, pocket, gap);
    if (owner >= 0) for (const p of pocket) labels[p] = owner;
  }
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
    const start = pixelOf(point, width, height);
    if (start < 0) {
      invalidIds.add(point.id);
      continue;
    }
    const owner = labels[start];
    if (wall[start] || owner >= 0) {
      invalidIds.add(point.id);
      if (owner >= 0) invalidIds.add(owner);
      continue;
    }
    if (
      flood(labels, wall, width, stack, start, point.id) >
      maxAreaOf(point, width, height)
    )
      invalidIds.add(point.id);
  }
  const leaked = points.filter((point) => {
    const start = pixelOf(point, width, height);
    return invalidIds.has(point.id) && start >= 0 && labels[start] >= 0;
  });
  if (leaked.length > 0)
    closeGaps(labels, wall, width, height, stack, leaked, invalidIds);
  absorbPockets(labels, wall, width, height, stack);
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
  const pointsIn = new Int32Array(areas.length);
  const fitsPoint = new Uint8Array(areas.length);
  for (const point of points) {
    const start = pixelOf(point, width, height);
    const id = start < 0 ? -1 : labels[start];
    if (id < 0) continue;
    pointsIn[id]++;
    if (areas[id] <= maxAreaOf(point, width, height)) fitsPoint[id] = 1;
  }
  const leaks = areas.map(
    (area, id) => area > maxArea && (pointsIn[id] !== 1 || !fitsPoint[id]),
  );
  if (leaks.some(Boolean)) {
    const { closed, count } = closedRegions(wall, width, height, stack);
    const offset = areas.length;
    for (let c = 0; c < count; c++) areas.push(0);
    for (let p = 0; p < labels.length; p++) {
      if (labels[p] < 0 || !leaks[labels[p]]) continue;
      labels[p] = closed[p] >= 0 ? offset + closed[p] : -1;
    }
    for (let p = 0; p < labels.length; p++)
      if (labels[p] >= offset) areas[labels[p]]++;
  }
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
