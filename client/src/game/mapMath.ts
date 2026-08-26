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

function wrapSplitX(a: Point, b: Point, mapW: number): [Point, Point][] {
  const d = b.x - a.x;
  if (Math.abs(d) <= mapW / 2) return [[a, b]];
  const sign = Math.sign(d);
  const bx = b.x - sign * mapW;
  const boundary = sign < 0 ? mapW : 0;
  const t = (boundary - a.x) / (bx - a.x);
  const y = a.y + t * (b.y - a.y);
  return [
    [a, { x: boundary, y }],
    [{ x: mapW - boundary, y }, b],
  ];
}

function wrapSplitY(a: Point, b: Point, mapH: number): [Point, Point][] {
  const d = b.y - a.y;
  if (Math.abs(d) <= mapH / 2) return [[a, b]];
  const sign = Math.sign(d);
  const by = b.y - sign * mapH;
  const boundary = sign < 0 ? mapH : 0;
  const t = (boundary - a.y) / (by - a.y);
  const x = a.x + t * (b.x - a.x);
  return [
    [a, { x, y: boundary }],
    [{ x, y: mapH - boundary }, b],
  ];
}

function wrapEdgeSegments(
  a: Point,
  b: Point,
  mapW: number,
  mapH: number,
): [Point, Point][] {
  const segments: [Point, Point][] = [];
  for (const [p1, p2] of wrapSplitX(a, b, mapW)) {
    segments.push(...wrapSplitY(p1, p2, mapH));
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
): [Point, Point][] {
  const segments: [Point, Point][] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const subSegments = wrapEdgeSegments(path[i], path[i + 1], mapW, mapH).map(
      ([p1, p2]): [Point, Point] => [toScreen(p1), toScreen(p2)],
    );
    segments.push(...subSegments);
  }
  return segments;
}
