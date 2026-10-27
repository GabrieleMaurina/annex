import { CUT_RANKS } from './ranks';

const RANK_BUCKETS = [0, ...CUT_RANKS.slice(0, -1)];

export interface AtomPair {
  a: number;
  b: number;
  length: number;
  strength: number;
}

export interface Atoms {
  atomOf: Int32Array;
  count: number;
  area: Float64Array;
  sumX: Float64Array;
  sumY: Float64Array;
  pairs: AtomPair[];
}

function floodAtoms(
  land: Uint8Array,
  barrier: Uint8Array,
  width: number,
  height: number,
  atomOf: Int32Array,
): number {
  const size = width * height;
  const stack = new Int32Array(size);
  let count = 0;
  for (let start = 0; start < size; start++) {
    if (!land[start] || barrier[start] || atomOf[start] >= 0) continue;
    let sp = 0;
    stack[sp++] = start;
    atomOf[start] = count;
    while (sp > 0) {
      const c = stack[--sp];
      const x = c % width;
      const visit = (n: number) => {
        if (land[n] && !barrier[n] && atomOf[n] < 0) {
          atomOf[n] = count;
          stack[sp++] = n;
        }
      };
      if (x > 0) visit(c - 1);
      if (x < width - 1) visit(c + 1);
      if (c >= width) visit(c - width);
      if (c + width < size) visit(c + width);
    }
    count++;
  }
  return count;
}

function absorbBarriers(
  land: Uint8Array,
  width: number,
  height: number,
  atomOf: Int32Array,
): void {
  const size = width * height;
  const queue = new Int32Array(size);
  let tail = 0;
  for (let i = 0; i < size; i++) if (atomOf[i] >= 0) queue[tail++] = i;
  for (let head = 0; head < tail; head++) {
    const c = queue[head];
    const x = c % width;
    const visit = (n: number) => {
      if (land[n] && atomOf[n] < 0) {
        atomOf[n] = atomOf[c];
        queue[tail++] = n;
      }
    };
    if (x > 0) visit(c - 1);
    if (x < width - 1) visit(c + 1);
    if (c >= width) visit(c - width);
    if (c + width < size) visit(c + width);
  }
}

function collectPairs(
  barrier: Uint8Array,
  width: number,
  height: number,
  atomOf: Int32Array,
  count: number,
): AtomPair[] {
  const bucketOf = new Int32Array(256);
  RANK_BUCKETS.forEach((rank, i) => (bucketOf[rank] = i));
  const tallies = new Map<number, { a: number; b: number; counts: number[] }>();
  const record = (i: number, j: number) => {
    const ai = atomOf[i];
    const aj = atomOf[j];
    if (ai < 0 || aj < 0 || ai === aj) return;
    const a = Math.min(ai, aj);
    const b = Math.max(ai, aj);
    const key = a * count + b;
    let tally = tallies.get(key);
    if (!tally) {
      tally = { a, b, counts: RANK_BUCKETS.map(() => 0) };
      tallies.set(key, tally);
    }
    tally.counts[bucketOf[Math.max(barrier[i], barrier[j])]]++;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) record(i, i + 1);
      if (y + 1 < height) record(i, i + width);
    }
  return [...tallies.values()].map(({ a, b, counts }) => {
    const length = counts.reduce((sum, n) => sum + n, 0);
    let seen = 0;
    let strength = 0;
    for (let k = 0; k < counts.length; k++) {
      seen += counts[k];
      if (seen * 2 >= length) {
        strength = RANK_BUCKETS[k];
        break;
      }
    }
    return { a, b, length, strength };
  });
}

export function buildAtoms(
  land: Uint8Array,
  barrier: Uint8Array,
  width: number,
  height: number,
): Atoms {
  const atomOf = new Int32Array(width * height).fill(-1);
  const count = floodAtoms(land, barrier, width, height, atomOf);
  absorbBarriers(land, width, height, atomOf);
  const area = new Float64Array(count);
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  for (let i = 0; i < atomOf.length; i++) {
    const atom = atomOf[i];
    if (atom < 0) continue;
    area[atom]++;
    sumX[atom] += i % width;
    sumY[atom] += Math.floor(i / width);
  }
  const pairs = collectPairs(barrier, width, height, atomOf, count);
  return { atomOf, count, area, sumX, sumY, pairs };
}
