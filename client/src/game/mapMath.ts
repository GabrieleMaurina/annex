export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getScales(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgW: number,
  imgH: number,
) {
  const scale = Math.min(canvasW / imgW, canvasH / imgH) * zoom;
  return {
    imgW,
    imgH,
    scaleX: scale,
    scaleY: scale,
  };
}

export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 10;

const RUBBER_RESISTANCE = 0.55;

function rubberBand(overshoot: number, dimension: number): number {
  return (
    (overshoot * dimension * RUBBER_RESISTANCE) /
    (dimension + RUBBER_RESISTANCE * overshoot)
  );
}

function rubberBandInverse(displayed: number, dimension: number): number {
  return (
    (displayed * dimension) / (RUBBER_RESISTANCE * (dimension - displayed))
  );
}

function rubberClamp(value: number, limit: number, dimension: number): number {
  if (Math.abs(value) <= limit) return value;
  const sign = value < 0 ? -1 : 1;
  return sign * (limit + rubberBand(Math.abs(value) - limit, dimension));
}

function rubberClampInverse(
  displayed: number,
  limit: number,
  dimension: number,
): number {
  if (Math.abs(displayed) <= limit) return displayed;
  const sign = displayed < 0 ? -1 : 1;
  return (
    sign * (limit + rubberBandInverse(Math.abs(displayed) - limit, dimension))
  );
}

function panLimits(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
) {
  const minScale = Math.min(canvasW / imgW, canvasH / imgH) * MIN_ZOOM;
  return {
    x: Math.max(0, (imgW * (scaleX - minScale)) / 2),
    y: Math.max(0, (imgH * (scaleY - minScale)) / 2),
  };
}

export function clampPan(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
  panX: number,
  panY: number,
) {
  const { x: kx, y: ky } = panLimits(
    canvasW,
    canvasH,
    scaleX,
    scaleY,
    imgW,
    imgH,
  );
  return { x: clamp(panX, -kx, kx), y: clamp(panY, -ky, ky) };
}

export function screenOffset(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgW: number,
  imgH: number,
  panX: number,
  panY: number,
) {
  const { scaleX, scaleY } = getScales(canvasW, canvasH, zoom, imgW, imgH);
  const { x: kx, y: ky } = panLimits(
    canvasW,
    canvasH,
    scaleX,
    scaleY,
    imgW,
    imgH,
  );
  return {
    x: (canvasW - imgW * scaleX) / 2 + rubberClamp(panX, kx, canvasW),
    y: (canvasH - imgH * scaleY) / 2 + rubberClamp(panY, ky, canvasH),
  };
}

export function createSettleSampler(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgW: number,
  imgH: number,
  panX: number,
  panY: number,
) {
  const { scaleX, scaleY } = getScales(canvasW, canvasH, zoom, imgW, imgH);
  const { x: kx, y: ky } = panLimits(
    canvasW,
    canvasH,
    scaleX,
    scaleY,
    imgW,
    imgH,
  );
  const target = { x: clamp(panX, -kx, kx), y: clamp(panY, -ky, ky) };
  const from = {
    x: rubberClamp(panX, kx, canvasW),
    y: rubberClamp(panY, ky, canvasH),
  };
  const settled =
    Math.abs(from.x - target.x) < 0.5 && Math.abs(from.y - target.y) < 0.5;
  return {
    target,
    settled,
    sample(eased: number) {
      const dx = from.x + (target.x - from.x) * eased;
      const dy = from.y + (target.y - from.y) * eased;
      return {
        x: rubberClampInverse(dx, kx, canvasW),
        y: rubberClampInverse(dy, ky, canvasH),
      };
    },
  };
}

export interface WrappedSegment {
  a: Point;
  b: Point;
  t0: number;
  t1: number;
}

function wrapSplitX(
  a: Point,
  b: Point,
  mapW: number,
  t0: number,
  t1: number,
): WrappedSegment[] {
  const d = b.x - a.x;
  if (Math.abs(d) <= mapW / 2) return [{ a, b, t0, t1 }];
  const sign = Math.sign(d);
  const bx = b.x - sign * mapW;
  const boundary = sign < 0 ? mapW : 0;
  const t = (boundary - a.x) / (bx - a.x);
  const y = a.y + t * (b.y - a.y);
  const tMid = t0 + t * (t1 - t0);
  return [
    { a, b: { x: boundary, y }, t0, t1: tMid },
    { a: { x: mapW - boundary, y }, b, t0: tMid, t1 },
  ];
}

function wrapSplitY(
  a: Point,
  b: Point,
  mapH: number,
  t0: number,
  t1: number,
): WrappedSegment[] {
  const d = b.y - a.y;
  if (Math.abs(d) <= mapH / 2) return [{ a, b, t0, t1 }];
  const sign = Math.sign(d);
  const by = b.y - sign * mapH;
  const boundary = sign < 0 ? mapH : 0;
  const t = (boundary - a.y) / (by - a.y);
  const x = a.x + t * (b.x - a.x);
  const tMid = t0 + t * (t1 - t0);
  return [
    { a, b: { x, y: boundary }, t0, t1: tMid },
    { a: { x, y: mapH - boundary }, b, t0: tMid, t1 },
  ];
}

function wrapEdgeSegments(
  a: Point,
  b: Point,
  mapW: number,
  mapH: number,
): WrappedSegment[] {
  const segments: WrappedSegment[] = [];
  for (const seg of wrapSplitX(a, b, mapW, 0, 1)) {
    segments.push(...wrapSplitY(seg.a, seg.b, mapH, seg.t0, seg.t1));
  }
  return segments;
}

export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function delaunayTriangles(pts: Point[]): number[][] {
  const n = pts.length;
  const tris: number[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const d =
          2 *
          (pts[i].x * (pts[j].y - pts[k].y) +
            pts[j].x * (pts[k].y - pts[i].y) +
            pts[k].x * (pts[i].y - pts[j].y));
        if (Math.abs(d) < 1e-9) continue;
        const i2 = pts[i].x * pts[i].x + pts[i].y * pts[i].y;
        const j2 = pts[j].x * pts[j].x + pts[j].y * pts[j].y;
        const k2 = pts[k].x * pts[k].x + pts[k].y * pts[k].y;
        const cx =
          (i2 * (pts[j].y - pts[k].y) +
            j2 * (pts[k].y - pts[i].y) +
            k2 * (pts[i].y - pts[j].y)) /
          d;
        const cy =
          (i2 * (pts[k].x - pts[j].x) +
            j2 * (pts[i].x - pts[k].x) +
            k2 * (pts[j].x - pts[i].x)) /
          d;
        const r = Math.hypot(pts[i].x - cx, pts[i].y - cy);
        let empty = true;
        for (let m = 0; m < n && empty; m++) {
          if (m === i || m === j || m === k) continue;
          if (Math.hypot(pts[m].x - cx, pts[m].y - cy) < r - 1e-6)
            empty = false;
        }
        if (empty) tris.push([i, j, k]);
      }
    }
  }
  return tris;
}

const CARVE_DEPTH_FACTOR = 0.6;

export function concaveHull(
  points: Point[],
  isAdjacent: (i: number, j: number) => boolean,
): Point[] {
  const n = points.length;
  const fallback = convexHull(points);
  if (n < 4) return fallback;

  const tris = delaunayTriangles(points);
  if (tris.length === 0) return fallback;

  const key = (a: number, b: number) => (a < b ? a * n + b : b * n + a);
  const push = (m: Map<number, number[]>, k: number, v: number) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };

  const edgeTris = new Map<number, number[]>();
  tris.forEach((t, ti) => {
    push(edgeTris, key(t[0], t[1]), ti);
    push(edgeTris, key(t[1], t[2]), ti);
    push(edgeTris, key(t[0], t[2]), ti);
  });

  const alive = tris.map(() => true);
  const boundaryEdges = () => {
    const edges = new Set<number>();
    for (const [k, list] of edgeTris) {
      if (list.filter((t) => alive[t]).length === 1) edges.add(k);
    }
    return edges;
  };

  const peelKeepsRegionWhole = (removed: number) => {
    const vertexTris = new Map<number, number[]>();
    let seed = -1;
    let count = 0;
    tris.forEach((t, ti) => {
      if (!alive[ti] || ti === removed) return;
      count++;
      if (seed < 0) seed = ti;
      for (const v of t) push(vertexTris, v, ti);
    });
    if (seed < 0) return false;
    const seen = new Set([seed]);
    const stack = [seed];
    while (stack.length) {
      const t = stack.pop()!;
      for (const v of tris[t]) {
        for (const nb of vertexTris.get(v)!) {
          if (!seen.has(nb)) {
            seen.add(nb);
            stack.push(nb);
          }
        }
      }
    }
    return seen.size === count;
  };

  let boundary = boundaryEdges();
  const skip = new Set<number>();
  for (;;) {
    let target = -1;
    let longest = 0;
    for (const k of boundary) {
      if (skip.has(k) || isAdjacent(Math.floor(k / n), k % n)) continue;
      const len = dist(points[Math.floor(k / n)], points[k % n]);
      if (len > longest) {
        longest = len;
        target = k;
      }
    }
    if (target < 0) break;

    const a = Math.floor(target / n);
    const b = target % n;
    const ti = edgeTris.get(target)!.find((t) => alive[t]);
    if (ti === undefined) {
      boundary.delete(target);
      continue;
    }
    const c = tris[ti].find((x) => x !== a && x !== b)!;
    const edgeLen = dist(points[a], points[b]);
    const depth =
      Math.abs(
        (points[c].x - points[a].x) * (points[b].y - points[a].y) -
          (points[c].y - points[a].y) * (points[b].x - points[a].x),
      ) / (edgeLen || 1);
    if (depth > CARVE_DEPTH_FACTOR * edgeLen || !peelKeepsRegionWhole(ti)) {
      skip.add(target);
      continue;
    }
    alive[ti] = false;
    boundary = boundaryEdges();
  }

  const adj = new Map<number, number[]>();
  for (const k of boundary) {
    push(adj, Math.floor(k / n), k % n);
    push(adj, k % n, Math.floor(k / n));
  }
  if (adj.size === 0) return fallback;

  let start = adj.keys().next().value!;
  for (const v of adj.keys()) {
    if (
      points[v].y < points[start].y ||
      (points[v].y === points[start].y && points[v].x < points[start].x)
    )
      start = v;
  }

  const order = [start];
  const used = new Set<number>();
  let prev: Point = { x: points[start].x, y: points[start].y - 1 };
  let cur = start;
  for (let guard = 0; guard < tris.length * 6 + 6; guard++) {
    const base = Math.atan2(prev.y - points[cur].y, prev.x - points[cur].x);
    let next = -1;
    let smallest = Infinity;
    for (const w of adj.get(cur)!) {
      if (used.has(cur * n + w)) continue;
      let turn =
        Math.atan2(points[w].y - points[cur].y, points[w].x - points[cur].x) -
        base;
      turn = ((turn % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (turn < 1e-9) turn += 2 * Math.PI;
      if (turn < smallest) {
        smallest = turn;
        next = w;
      }
    }
    if (next < 0) break;
    used.add(cur * n + next);
    prev = points[cur];
    cur = next;
    if (cur === start) break;
    order.push(cur);
  }
  if (order.length < 3) return fallback;

  const inBlob = new Set<number>();
  tris.forEach((t, i) => {
    if (alive[i]) for (const v of t) inBlob.add(v);
  });
  const neighbors = (v: number) => {
    const list: number[] = [];
    for (let w = 0; w < n; w++) if (w !== v && isAdjacent(v, w)) list.push(w);
    return list;
  };
  const attached = new Set<number>();
  const spikeTour = (node: number): number[] => {
    attached.add(node);
    const seq = [node];
    for (const c of neighbors(node)) {
      if (!inBlob.has(c) && !attached.has(c)) seq.push(...spikeTour(c), node);
    }
    return seq;
  };

  const outline: number[] = [];
  for (const b of order) {
    outline.push(b);
    for (const c of neighbors(b)) {
      if (!inBlob.has(c) && !attached.has(c)) outline.push(...spikeTour(c), b);
    }
  }
  for (let v = 0; v < n; v++) {
    if (!inBlob.has(v) && !attached.has(v)) outline.push(...spikeTour(v));
  }
  return outline.map((idx) => points[idx]);
}

export function getAnchoredPanelPosition(
  anchor: Point,
  anchorRadius: number,
  panelWidth: number,
  panelHeight: number,
  screenW: number,
  screenH: number,
  gap: number,
  edgeMargin: number,
  reservedBottom: number,
): { left: number; top: number } {
  const rawLeft = anchor.x - panelWidth / 2;
  const fitsBelow =
    anchor.y + anchorRadius + gap + panelHeight <= screenH - reservedBottom;
  const rawTop = fitsBelow
    ? anchor.y + anchorRadius + gap
    : anchor.y - anchorRadius - gap - panelHeight;
  return {
    left: clamp(rawLeft, edgeMargin, screenW - panelWidth - edgeMargin),
    top: clamp(rawTop, edgeMargin, screenH - reservedBottom - panelHeight),
  };
}

export function buildWrappedPathSegments(
  path: Point[],
  toScreen: (p: Point) => Point,
  mapW: number,
  mapH: number,
): WrappedSegment[] {
  const segments: WrappedSegment[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    for (const seg of wrapEdgeSegments(path[i], path[i + 1], mapW, mapH)) {
      segments.push({
        a: toScreen(seg.a),
        b: toScreen(seg.b),
        t0: seg.t0,
        t1: seg.t1,
      });
    }
  }
  return segments;
}
