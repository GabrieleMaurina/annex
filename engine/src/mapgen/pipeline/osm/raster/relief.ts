import { OsmElevation } from '../types';

const RELIEF_RADIUS_KM = 5;
const RELIEF_METERS = 800;
const MAX_LAND_SHARE = 0.15;
const THRESHOLD_STEP = 1.1;
const SPREAD_RADIUS = 8;
const SPREAD_PASSES = 3;
const SPREAD_LEVEL = 0.1;

function slideExtreme(
  values: Float32Array,
  start: number,
  step: number,
  count: number,
  radius: number,
  sign: number,
  out: Float32Array,
  queue: Int32Array,
): void {
  const at = (i: number) => values[start + i * step] * sign;
  let head = 0;
  let tail = 0;
  let next = 0;
  for (let i = 0; i < count; i++) {
    for (; next < count && next <= i + radius; next++) {
      while (tail > head && at(queue[tail - 1]) <= at(next)) tail--;
      queue[tail++] = next;
    }
    while (queue[head] < i - radius) head++;
    out[start + i * step] = values[start + queue[head] * step];
  }
}

function windowExtreme(
  heights: Float32Array,
  width: number,
  height: number,
  radius: number,
  sign: number,
): Float32Array {
  const rows = new Float32Array(heights.length);
  const result = new Float32Array(heights.length);
  const queue = new Int32Array(Math.max(width, height));
  for (let y = 0; y < height; y++)
    slideExtreme(heights, y * width, 1, width, radius, sign, rows, queue);
  for (let x = 0; x < width; x++)
    slideExtreme(rows, x, width, height, radius, sign, result, queue);
  return result;
}

function blurLine(
  values: Float32Array,
  start: number,
  step: number,
  count: number,
  radius: number,
  out: Float32Array,
): void {
  const at = (i: number) =>
    values[start + Math.min(count - 1, Math.max(0, i)) * step];
  let sum = 0;
  for (let i = -radius; i <= radius; i++) sum += at(i);
  for (let i = 0; i < count; i++) {
    out[start + i * step] = sum / (2 * radius + 1);
    sum += at(i + radius + 1) - at(i - radius);
  }
}

function blur(
  values: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const rows = new Float32Array(values.length);
  const result = new Float32Array(values.length);
  for (let y = 0; y < height; y++)
    blurLine(values, y * width, 1, width, radius, rows);
  for (let x = 0; x < width; x++)
    blurLine(rows, x, width, height, radius, result);
  return result;
}

function thresholdMask(
  relief: Float32Array,
  threshold: number,
  width: number,
  height: number,
): Uint8Array {
  let spread: Float32Array = Float32Array.from(relief, (value) =>
    value >= threshold ? 1 : 0,
  );
  for (let pass = 0; pass < SPREAD_PASSES; pass++)
    spread = blur(spread, width, height, SPREAD_RADIUS);
  return Uint8Array.from(spread, (value) => (value >= SPREAD_LEVEL ? 1 : 0));
}

export function reliefMap(
  elevation: OsmElevation,
  width: number,
  height: number,
): Float32Array {
  const radius = Math.max(1, Math.round(RELIEF_RADIUS_KM / elevation.pixelKm));
  const high = windowExtreme(elevation.heights, width, height, radius, 1);
  const low = windowExtreme(elevation.heights, width, height, radius, -1);
  return Float32Array.from(high, (top, i) => top - low[i]);
}

export function ruggedMask(
  relief: Float32Array,
  land: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const landRelief = relief.filter((_, i) => land[i] === 1).sort();
  const cap = Math.floor(landRelief.length * MAX_LAND_SHARE);
  if (cap === 0) return new Uint8Array(land.length);
  let threshold = Math.max(RELIEF_METERS, landRelief[landRelief.length - cap]);
  for (;;) {
    const mask = thresholdMask(relief, threshold, width, height);
    let covered = 0;
    for (let i = 0; i < mask.length; i++) covered += mask[i] & land[i];
    if (covered <= cap) return mask;
    threshold *= THRESHOLD_STEP;
  }
}
