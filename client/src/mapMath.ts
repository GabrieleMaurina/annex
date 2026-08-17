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
  return {
    imgW,
    imgH,
    scaleX: (canvasW / imgW) * zoom,
    scaleY: (canvasH / imgH) * zoom,
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
  return {
    x: clamp(x, canvasW - imgW * scaleX, 0),
    y: clamp(y, canvasH - imgH * scaleY, 0),
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

// Splits a world-space edge that crosses more than half the map's width or
// height into the segments of its shorter, wrap-around path instead of a
// single straight line — mirrors the mapper's edge-drawing logic.
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

// Positions a fixed-size panel next to a screen-space anchor point (e.g. a
// territory), preferring just below it, falling back to just above, and
// clamped to stay within the screen (minus a reserved bottom strip).
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

// Builds the screen-space segments for an animated path across territory
// centers (world coordinates), wrapping around the map where that's the
// shorter route. Segments run all the way to each territory's true center
// (not just to the edge of its vertex circle) — since vertices are drawn on
// top of this path, that keeps the animation spawning and disappearing
// underneath them instead of popping in/out right at their edge.
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
