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

export function clampOffset(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
) {
  const scaledW = imgW * scaleX;
  const scaledH = imgH * scaleY;
  return {
    x:
      scaledW <= canvasW
        ? (canvasW - scaledW) / 2
        : clamp(x, canvasW - scaledW, 0),
    y:
      scaledH <= canvasH
        ? (canvasH - scaledH) / 2
        : clamp(y, canvasH - scaledH, 0),
  };
}

export function getClampedOffset(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
) {
  const { scaleX, scaleY } = getScales(canvasW, canvasH, zoom, imgW, imgH);
  return clampOffset(canvasW, canvasH, scaleX, scaleY, imgW, imgH, x, y);
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
