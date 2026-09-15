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

function labelComponentsFromSeeds(
  seeds: Int32Array,
  boxWidth: number,
  boxHeight: number,
  isMember: (i: number) => boolean,
  out: Int32Array,
): number {
  let count = 0;
  const stack = new Int32Array(boxWidth * boxHeight);
  const neighborBuf = new Int32Array(4);
  for (const start of seeds) {
    if (!isMember(start) || out[start] !== -1) continue;
    out[start] = count;
    let stackTop = 0;
    stack[stackTop++] = start;
    while (stackTop > 0) {
      const local = stack[--stackTop];
      const neighborCount = neighborsOfLocalInto(
        local,
        boxWidth,
        boxHeight,
        neighborBuf,
      );
      for (let ni = 0; ni < neighborCount; ni++) {
        const n = neighborBuf[ni];
        if (out[n] === -1 && isMember(n)) {
          out[n] = count;
          stack[stackTop++] = n;
        }
      }
    }
    count++;
  }
  return count;
}

function watershedSplit(
  pixels: number[],
  bodyFlag: Uint8Array,
  compOf: Int32Array,
  markerA: number,
  markerB: number,
  boxWidth: number,
  boxHeight: number,
  toLocal: (i: number) => number,
): [number[], number[]] {
  const labelOfLocal = new Int8Array(bodyFlag.length).fill(-1);
  const queue = new Int32Array(bodyFlag.length);
  let tail = 0;
  for (const i of pixels) {
    const local = toLocal(i);
    if (compOf[local] === markerA) {
      labelOfLocal[local] = 0;
      queue[tail++] = local;
    } else if (compOf[local] === markerB) {
      labelOfLocal[local] = 1;
      queue[tail++] = local;
    }
  }
  let head = 0;
  const neighborBuf = new Int32Array(4);
  while (head < tail) {
    const local = queue[head++];
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
      queue[tail++] = n;
    }
  }
  const a: number[] = [];
  const b: number[] = [];
  for (const i of pixels) (labelOfLocal[toLocal(i)] === 0 ? a : b).push(i);
  return [a, b];
}

function findLocal(parent: Int32Array, x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

function unionLocal(
  parent: Int32Array,
  size: Int32Array,
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
  const qualifyMerged = size[big] >= minPieceSize;
  return (
    qualifyingCount -
    (qualifyA ? 1 : 0) -
    (qualifyB ? 1 : 0) +
    (qualifyMerged ? 1 : 0)
  );
}

function findSmallestErosionSplitDepth(
  localPixels: Int32Array,
  localDist: Int32Array,
  boxWidth: number,
  boxHeight: number,
  maxDist: number,
  minPieceSize: number,
): number | null {
  const bucket: number[][] = Array.from({ length: maxDist + 1 }, () => []);
  for (const local of localPixels) bucket[localDist[local]].push(local);

  const parent = new Int32Array(boxWidth * boxHeight).fill(-1);
  const size = new Int32Array(boxWidth * boxHeight);
  let qualifyingCount = 0;
  let winningK: number | null = null;
  const neighborBuf = new Int32Array(4);

  for (let d = maxDist; d >= 1; d--) {
    for (const local of bucket[d]) {
      parent[local] = local;
      size[local] = 1;
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
          qualifyingCount = unionLocal(
            parent,
            size,
            minPieceSize,
            qualifyingCount,
            local,
            n,
          );
        }
      }
    }
    const k = d - 1;
    if (k >= 1 && k < maxDist && qualifyingCount >= 2) winningK = k;
  }
  return winningK;
}

const MAX_BOX_AREA_RATIO = 6;

export function findChokepointSplit(
  pixels: number[],
  distToLand: Int32Array,
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

  const winningK = findSmallestErosionSplitDepth(
    localPixels,
    localDist,
    boxWidth,
    boxHeight,
    maxDist,
    minPieceSize,
  );
  if (winningK === null) return null;

  const compOf = new Int32Array(boxWidth * boxHeight);
  for (const local of localPixels) compOf[local] = -1;
  const compCount = labelComponentsFromSeeds(
    localPixels,
    boxWidth,
    boxHeight,
    (local) => bodyFlag[local] === 1 && localDist[local] > winningK,
    compOf,
  );
  if (compCount < 2) return null;

  const sizes: number[] = new Array(compCount).fill(0);
  for (const local of localPixels) {
    const c = compOf[local];
    if (c >= 0) sizes[c]++;
  }
  const order = sizes.map((_, idx) => idx).sort((a, b) => sizes[b] - sizes[a]);
  const markerA = order[0];
  const markerB = order[1];
  if (sizes[markerB] < minPieceSize) return null;

  return watershedSplit(
    pixels,
    bodyFlag,
    compOf,
    markerA,
    markerB,
    boxWidth,
    boxHeight,
    toLocal,
  );
}
