export function labelComponents(
  width: number,
  height: number,
  isMember: (i: number) => boolean,
  out: Int32Array,
): number {
  const size = width * height;
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < size; start++) {
    if (!isMember(start) || out[start] !== -1) continue;
    out[start] = count;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      const x = i % width;
      const y = (i / width) | 0;
      if (x > 0 && out[i - 1] === -1 && isMember(i - 1)) {
        out[i - 1] = count;
        stack.push(i - 1);
      }
      if (x + 1 < width && out[i + 1] === -1 && isMember(i + 1)) {
        out[i + 1] = count;
        stack.push(i + 1);
      }
      if (y > 0 && out[i - width] === -1 && isMember(i - width)) {
        out[i - width] = count;
        stack.push(i - width);
      }
      if (y + 1 < height && out[i + width] === -1 && isMember(i + width)) {
        out[i + width] = count;
        stack.push(i + width);
      }
    }
    count++;
  }
  return count;
}

export function neighborsOfPixel(
  i: number,
  width: number,
  height: number,
): number[] {
  const x = i % width;
  const y = (i / width) | 0;
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x + 1 < width) out.push(i + 1);
  if (y > 0) out.push(i - width);
  if (y + 1 < height) out.push(i + width);
  return out;
}

export function computeDistanceToLand(
  landLabelGrid: Int16Array,
  width: number,
  height: number,
): Int32Array {
  const size = width * height;
  const dist = new Int32Array(size).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < size; i++) {
    if (landLabelGrid[i] >= 0) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    for (const n of neighborsOfPixel(i, width, height)) {
      if (dist[n] !== -1) continue;
      dist[n] = dist[i] + 1;
      queue.push(n);
    }
  }
  return dist;
}

export function touchingLands(
  pixels: number[],
  landLabelGrid: Int16Array,
  width: number,
  height: number,
): Set<number> {
  const lands = new Set<number>();
  for (const i of pixels) {
    for (const n of neighborsOfPixel(i, width, height)) {
      const landId = landLabelGrid[n];
      if (landId >= 0) lands.add(landId);
    }
  }
  return lands;
}
