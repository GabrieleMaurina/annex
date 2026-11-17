export const CHAMFER_STEP = 3;
const CHAMFER_DIAGONAL = 4;
const UNREACHED = 1 << 29;

export function forEachNeighbor(
  p: number,
  width: number,
  size: number,
  visit: (q: number) => void,
) {
  const x = p % width;
  if (x > 0) visit(p - 1);
  if (x < width - 1) visit(p + 1);
  if (p >= width) visit(p - width);
  if (p + width < size) visit(p + width);
}

export function borderDistance(
  border: (p: number) => boolean,
  width: number,
  size: number,
): Int32Array {
  const distance = new Int32Array(size);
  for (let p = 0; p < size; p++) if (border(p)) distance[p] = UNREACHED;
  const relax = (p: number, dx: number, dy: number, step: number) => {
    const x = (p % width) + dx;
    const q = p + dy * width + dx;
    if (x < 0 || x >= width || q < 0 || q >= size) return;
    distance[p] = Math.min(distance[p], distance[q] + step);
  };
  for (let p = 0; p < size; p++) {
    if (distance[p] === 0) continue;
    relax(p, -1, 0, CHAMFER_STEP);
    relax(p, 0, -1, CHAMFER_STEP);
    relax(p, -1, -1, CHAMFER_DIAGONAL);
    relax(p, 1, -1, CHAMFER_DIAGONAL);
  }
  for (let p = size - 1; p >= 0; p--) {
    if (distance[p] === 0) continue;
    relax(p, 1, 0, CHAMFER_STEP);
    relax(p, 0, 1, CHAMFER_STEP);
    relax(p, 1, 1, CHAMFER_DIAGONAL);
    relax(p, -1, 1, CHAMFER_DIAGONAL);
  }
  return distance;
}

export function fillEnclosedGaps(labels: Int16Array, width: number) {
  const size = labels.length;
  const seen = new Uint8Array(size);
  for (let start = 0; start < size; start++) {
    if (labels[start] !== -1 || seen[start]) continue;
    seen[start] = 1;
    const gap = [start];
    const around = new Set<number>();
    let touchesEdge = false;
    for (let i = 0; i < gap.length; i++) {
      const p = gap[i];
      const x = p % width;
      if (x === 0 || x === width - 1 || p < width || p + width >= size)
        touchesEdge = true;
      forEachNeighbor(p, width, size, (q) => {
        if (labels[q] !== -1) around.add(labels[q]);
        else if (!seen[q]) {
          seen[q] = 1;
          gap.push(q);
        }
      });
    }
    const [label] = around;
    if (touchesEdge || around.size !== 1 || label < 0) continue;
    for (const p of gap) labels[p] = label;
  }
}
