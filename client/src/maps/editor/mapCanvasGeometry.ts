import { clamp } from './mapViewport';

export interface Point {
  x: number;
  y: number;
}

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function segmentsProperlyIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): boolean {
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t =
    lenSq === 0
      ? 0
      : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq, 0, 1);
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

export function wrapSplitX(a: Point, b: Point, mapW: number): [Point, Point][] {
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

export function wrapSplitY(a: Point, b: Point, mapH: number): [Point, Point][] {
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

export function wrapEdgeSegments(
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

export function touchDistance(touches: React.TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
}

export function touchMidpoint(touches: React.TouchList): {
  clientX: number;
  clientY: number;
} {
  return {
    clientX: (touches[0].clientX + touches[1].clientX) / 2,
    clientY: (touches[0].clientY + touches[1].clientY) / 2,
  };
}
