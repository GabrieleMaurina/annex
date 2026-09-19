import type { WrapAxes } from '../../../game/mapMath';
import {
  edgeKey,
  pointToSegmentDistance,
  segmentsProperlyIntersect,
  wrapEdgeSegments,
  type Point,
} from '../mapCanvasGeometry';
import type { EditorTerritory as Territory } from '../model/editorTypes';

export interface Viewport {
  imgW: number;
  imgH: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

const VERTEX_DIAMETERS_PER_LONGEST_SIDE = 50;
const HIT_TOLERANCE = 6;
const HIT_RADIUS_MULTIPLIER = 2;

export const SEA_SIZE_MULTIPLIER = 1.5;
export const NO_WRAP: WrapAxes = { x: false, y: false };

export function wrapAxesOf(e: {
  ctrlKey: boolean;
  shiftKey: boolean;
}): WrapAxes {
  return { x: e.ctrlKey, y: e.shiftKey };
}

export function wrapOf(t: Territory, otherId: number): WrapAxes | undefined {
  return t.wraps.find((w) => w.id === otherId);
}

export function getVertexRadius(imgW: number, imgH: number): number {
  return Math.max(imgW, imgH) / (VERTEX_DIAMETERS_PER_LONGEST_SIDE * 2);
}

export function hitVertex(
  territories: Territory[],
  viewport: Viewport,
  pos: Point,
): Territory | null {
  const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = viewport;
  const baseHitRadius =
    getVertexRadius(imgW, imgH) * HIT_RADIUS_MULTIPLIER * scaleX;
  let nearest: Territory | null = null;
  let nearestDist = Infinity;
  for (const t of territories) {
    const hitRadius =
      (t.isSea ? baseHitRadius * SEA_SIZE_MULTIPLIER : baseHitRadius) +
      HIT_TOLERANCE;
    const d = Math.hypot(
      pos.x - (t.x * scaleX + offsetX),
      pos.y - (t.y * scaleY + offsetY),
    );
    if (d <= hitRadius && d < nearestDist) {
      nearest = t;
      nearestDist = d;
    }
  }
  return nearest;
}

export function segmentWouldCross(
  territories: Territory[],
  viewport: Viewport,
  from: Point,
  to: Point,
  excludeIds: Set<number>,
  forced: WrapAxes,
): boolean {
  const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = viewport;
  const toScreenPos = (p: Point): Point => ({
    x: p.x * scaleX + offsetX,
    y: p.y * scaleY + offsetY,
  });
  const toScreenSegments = (
    a: Point,
    b: Point,
    axes?: WrapAxes,
  ): [Point, Point][] =>
    wrapEdgeSegments(a, b, imgW, imgH, axes).map(
      ([p1, p2]) => [toScreenPos(p1), toScreenPos(p2)] as [Point, Point],
    );
  const candidateSegments = toScreenSegments(from, to, forced);
  const radius = getVertexRadius(imgW, imgH) * scaleX;
  const byId = new Map(territories.map((t) => [t.id, t]));

  for (const v of territories) {
    if (excludeIds.has(v.id)) continue;
    const vScreen = toScreenPos(v);
    for (const [p1, p2] of candidateSegments) {
      if (pointToSegmentDistance(vScreen, p1, p2) < radius) return true;
    }
  }

  const seen = new Set<string>();
  for (const t of territories) {
    for (const n of t.neighbors) {
      if (excludeIds.has(t.id) || excludeIds.has(n)) continue;
      const key = edgeKey(t.id, n);
      if (seen.has(key)) continue;
      seen.add(key);
      const other = byId.get(n);
      if (!other) continue;
      const existingSegments = toScreenSegments(t, other, wrapOf(t, n));
      for (const [c1, c2] of candidateSegments) {
        for (const [e1, e2] of existingSegments) {
          if (segmentsProperlyIntersect(c1, c2, e1, e2)) return true;
        }
      }
    }
  }
  return false;
}
