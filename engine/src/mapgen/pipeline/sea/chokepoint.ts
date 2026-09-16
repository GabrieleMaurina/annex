function neighborsOfLocalInto(
  local: number,
  boxWidth: number,
  boxHeight: number,
  out: Int32Array,
): number {
  const x = local % boxWidth;
  const y = (local / boxWidth) | 0;
  let n = 0;
  if (x > 0) out[n++] = local - 1;
  if (x + 1 < boxWidth) out[n++] = local + 1;
  if (y > 0) out[n++] = local - boxWidth;
  if (y + 1 < boxHeight) out[n++] = local + boxWidth;
  return n;
}

function findLocal(parent: Int32Array, x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

function unionRoots(
  parent: Int32Array,
  size: Int32Array,
  liveRoots: Set<number>,
  minPieceSize: number,
  qualifyingCount: number,
  a: number,
  b: number,
): number {
  const ra = findLocal(parent, a);
  const rb = findLocal(parent, b);
  if (ra === rb) return qualifyingCount;
  const qualifyA = size[ra] >= minPieceSize;
  const qualifyB = size[rb] >= minPieceSize;
  const big = size[ra] >= size[rb] ? ra : rb;
  const small = big === ra ? rb : ra;
  parent[small] = big;
  size[big] += size[small];
  liveRoots.delete(small);
  const qualifyMerged = size[big] >= minPieceSize;
  return (
    qualifyingCount -
    (qualifyA ? 1 : 0) -
    (qualifyB ? 1 : 0) +
    (qualifyMerged ? 1 : 0)
  );
}

interface SplitCandidate {
  score: number;
  a: number[];
  b: number[];
}

function betterCandidate(
  current: SplitCandidate | null,
  next: SplitCandidate | null,
): SplitCandidate | null {
  if (!next) return current;
  if (!current || next.score > current.score) return next;
  return current;
}

const MAX_BOX_AREA_RATIO = 6;

export function findChokepointSplit(
  pixels: number[],
  distToLand: Int32Array,
  landLabelGrid: Int16Array,
  landAdjacency: Map<number, Set<number>>,
  width: number,
  height: number,
  minPieceSize: number,
): [number[], number[]] | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let maxDist = 0;
  for (const i of pixels) {
    const x = i % width;
    const y = (i / width) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (distToLand[i] > maxDist) maxDist = distToLand[i];
  }
  if (maxDist === 0) return null;

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  if (boxWidth * boxHeight > pixels.length * MAX_BOX_AREA_RATIO) return null;

  const toLocal = (i: number): number => {
    const x = i % width;
    const y = (i / width) | 0;
    return (y - minY) * boxWidth + (x - minX);
  };

  const bodyFlag = new Uint8Array(boxWidth * boxHeight);
  const localDist = new Int32Array(boxWidth * boxHeight).fill(-1);
  const localPixels = new Int32Array(pixels.length);
  for (let idx = 0; idx < pixels.length; idx++) {
    const local = toLocal(pixels[idx]);
    localPixels[idx] = local;
    bodyFlag[local] = 1;
    localDist[local] = distToLand[pixels[idx]];
  }

  const bucket: number[][] = Array.from({ length: maxDist + 1 }, () => []);
  for (const local of localPixels) bucket[localDist[local]].push(local);

  const parent = new Int32Array(boxWidth * boxHeight).fill(-1);
  const size = new Int32Array(boxWidth * boxHeight);
  const liveRoots = new Set<number>();
  let qualifyingCount = 0;
  const neighborBuf = new Int32Array(4);

  const labelOfLocal = new Int8Array(boxWidth * boxHeight);
  const queueLocal = new Int32Array(boxWidth * boxHeight);

  const evaluateCandidate = (
    rootA: number,
    rootB: number,
    k: number,
  ): SplitCandidate => {
    for (const local of localPixels) labelOfLocal[local] = -1;
    let tail = 0;
    for (const local of localPixels) {
      if (localDist[local] <= k) continue;
      const root = findLocal(parent, local);
      if (root === rootA) {
        labelOfLocal[local] = 0;
        queueLocal[tail++] = local;
      } else if (root === rootB) {
        labelOfLocal[local] = 1;
        queueLocal[tail++] = local;
      }
    }
    let head = 0;
    while (head < tail) {
      const local = queueLocal[head++];
      const neighborCount = neighborsOfLocalInto(
        local,
        boxWidth,
        boxHeight,
        neighborBuf,
      );
      for (let ni = 0; ni < neighborCount; ni++) {
        const n = neighborBuf[ni];
        if (bodyFlag[n] !== 1 || labelOfLocal[n] !== -1) continue;
        labelOfLocal[n] = labelOfLocal[local];
        queueLocal[tail++] = n;
      }
    }

    let sizeA = 0;
    let sizeB = 0;
    let cutLength = 0;
    const landsA = new Set<number>();
    const landsB = new Set<number>();
    const a: number[] = [];
    const b: number[] = [];
    for (let idx = 0; idx < pixels.length; idx++) {
      const global = pixels[idx];
      const local = localPixels[idx];
      const label = labelOfLocal[local];
      if (label === 0) {
        sizeA++;
        a.push(global);
      } else {
        sizeB++;
        b.push(global);
      }
      const lands = label === 0 ? landsA : landsB;
      const gx = global % width;
      const gy = (global / width) | 0;
      if (gx > 0) {
        const landId = landLabelGrid[global - 1];
        if (landId >= 0) lands.add(landId);
      }
      if (gx + 1 < width) {
        const landId = landLabelGrid[global + 1];
        if (landId >= 0) lands.add(landId);
      }
      if (gy > 0) {
        const landId = landLabelGrid[global - width];
        if (landId >= 0) lands.add(landId);
      }
      if (gy + 1 < height) {
        const landId = landLabelGrid[global + width];
        if (landId >= 0) lands.add(landId);
      }
      const x = local % boxWidth;
      if (x + 1 < boxWidth) {
        const rn = local + 1;
        if (bodyFlag[rn] === 1 && labelOfLocal[rn] !== label) cutLength++;
      }
      if (local + boxWidth < boxWidth * boxHeight) {
        const dn = local + boxWidth;
        if (bodyFlag[dn] === 1 && labelOfLocal[dn] !== label) cutLength++;
      }
    }

    let severedPairs = 0;
    for (const x of landsA) {
      if (landsB.has(x)) continue;
      for (const y of landsB) {
        if (landsA.has(y)) continue;
        if (!landAdjacency.get(x)?.has(y)) severedPairs++;
      }
    }

    const smaller = Math.min(sizeA, sizeB);
    const score = smaller / Math.max(1, cutLength) / (1 + severedPairs);
    return { score, a, b };
  };

  let best: SplitCandidate | null = null;
  let lastEvaluatedA = -1;
  let lastEvaluatedB = -1;

  for (let d = maxDist; d >= 1; d--) {
    for (const local of bucket[d]) {
      parent[local] = local;
      size[local] = 1;
      liveRoots.add(local);
      if (1 >= minPieceSize) qualifyingCount++;
      const neighborCount = neighborsOfLocalInto(
        local,
        boxWidth,
        boxHeight,
        neighborBuf,
      );
      for (let ni = 0; ni < neighborCount; ni++) {
        const n = neighborBuf[ni];
        if (parent[n] !== -1) {
          qualifyingCount = unionRoots(
            parent,
            size,
            liveRoots,
            minPieceSize,
            qualifyingCount,
            local,
            n,
          );
        }
      }
    }

    const k = d - 1;
    if (k < 1 || k >= maxDist || qualifyingCount < 2) continue;

    let rootA = -1;
    let rootB = -1;
    let sizeA = -1;
    let sizeB = -1;
    for (const r of liveRoots) {
      const s = size[r];
      if (s > sizeA) {
        rootB = rootA;
        sizeB = sizeA;
        rootA = r;
        sizeA = s;
      } else if (s > sizeB) {
        rootB = r;
        sizeB = s;
      }
    }
    if (rootB === -1 || sizeB < minPieceSize) continue;

    if (rootA === lastEvaluatedA && rootB === lastEvaluatedB) continue;
    lastEvaluatedA = rootA;
    lastEvaluatedB = rootB;
    best = betterCandidate(best, evaluateCandidate(rootA, rootB, k));
  }

  if (!best) return null;
  return [best.a, best.b];
}
