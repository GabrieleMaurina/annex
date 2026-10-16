export interface RegionShape {
  fill: Path2D;
  outline: Path2D;
}

function boundaryEdges(
  labels: Int16Array,
  width: number,
  height: number,
): Map<number, number[]> {
  const stride = width + 1;
  const edges = new Map<number, number[]>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const label = labels[i];
      if (label < 0) continue;
      const v = y * stride + x;
      const top = y === 0 || labels[i - width] !== label;
      const right = x === width - 1 || labels[i + 1] !== label;
      const bottom = y === height - 1 || labels[i + width] !== label;
      const left = x === 0 || labels[i - 1] !== label;
      if (!top && !right && !bottom && !left) continue;
      let list = edges.get(label);
      if (!list) {
        list = [];
        edges.set(label, list);
      }
      if (top) list.push(v, v + 1);
      if (right) list.push(v + 1, v + 1 + stride);
      if (bottom) list.push(v + 1 + stride, v + stride);
      if (left) list.push(v + stride, v);
    }
  }
  return edges;
}

function chainLoops(edges: number[]): number[][] {
  const next = new Map<number, number[]>();
  for (let e = 0; e < edges.length; e += 2) {
    const targets = next.get(edges[e]);
    if (targets) targets.push(edges[e + 1]);
    else next.set(edges[e], [edges[e + 1]]);
  }
  const loops: number[][] = [];
  for (const [start, targets] of next) {
    while (targets.length > 0) {
      const loop = [start];
      let v = targets.pop()!;
      while (v !== start) {
        loop.push(v);
        v = next.get(v)!.pop()!;
      }
      loops.push(loop);
    }
  }
  return loops;
}

function corners(loop: number[], stride: number): number[] {
  const points: number[] = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const prev = loop[(i + n - 1) % n];
    const cur = loop[i];
    const next = loop[(i + 1) % n];
    if (cur - prev !== next - cur)
      points.push(cur % stride, Math.floor(cur / stride));
  }
  return points;
}

function signedArea(points: number[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    area += points[i] * points[j + 1] - points[j] * points[i + 1];
  }
  return area / 2;
}

function appendLoop(path: Path2D, points: number[]) {
  path.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2)
    path.lineTo(points[i], points[i + 1]);
  path.closePath();
}

export function traceRegionShapes(
  labels: Int16Array,
  width: number,
  height: number,
  minHoleArea: number,
): Map<number, RegionShape> {
  const stride = width + 1;
  const shapes = new Map<number, RegionShape>();
  for (const [id, edges] of boundaryEdges(labels, width, height)) {
    const fill = new Path2D();
    const outline = new Path2D();
    for (const loop of chainLoops(edges)) {
      const points = corners(loop, stride);
      appendLoop(fill, points);
      const area = signedArea(points);
      if (area > 0 || area <= -minHoleArea) appendLoop(outline, points);
    }
    shapes.set(id, { fill, outline });
  }
  return shapes;
}
