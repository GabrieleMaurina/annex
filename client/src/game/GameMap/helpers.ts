import type { Territory } from '../mapData';
import {
  getScales as computeScales,
  screenOffset as computeScreenOffset,
  concaveHull,
  convexHull,
  type Point,
} from '../mapMath';

export type { Point };

export interface Transform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export type DragState = {
  startPos: Point;
  startTransform: Point;
  moved: boolean;
} | null;

export const HIT_TOLERANCE = 6;
export const HIT_RADIUS_MULTIPLIER = 2;
export const DRAG_THRESHOLD = 4;
export const TROOP_PANEL_GAP = 10;
export const TROOP_PANEL_HEIGHT = 50;
export const TROOP_PANEL_WIDTH = 350;
export const ATTACK_PANEL_WIDTH = 460;
export const ATTACK_PANEL_HEIGHT = 160;
export const SCREEN_EDGE_MARGIN = 8;
export const TURN_PANEL_RESERVED_HEIGHT = 70;
export const TOP_BUTTON_GAP = 16;
export const DEFAULT_CARDS_BUTTONS_TOP = 63;
export const PLACEMENT_PHASE_DURATION = 10;
export const CAPITAL_PHASE_DURATION = 60;

export const UNCLAIMED_TERRITORY_COLOR = '#6c757d';
export const ENTRENCHED_OCTAGON_FILL = '#495057';
export const ENTRENCHED_OCTAGON_STROKE = '#212529';

export const STATE_STYLE = {
  normal: { stroke: '#000000', width: 2 },
  selectable: { stroke: '#888888', width: 7 },
  hovered: { stroke: '#bbbbbb', width: 7 },
  selected: { stroke: '#ffffff', width: 7 },
};

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

const ARC_STEP = Math.PI / 10;
const MITER_CAP = 2;
const REFLEX_FILLET = 0.6;

function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-6) return p2;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

function segmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

function removeLoops(poly: Point[]): Point[] {
  let result = poly;
  for (let guard = 0; guard < poly.length * 2; guard++) {
    const n = result.length;
    let clip: { i: number; j: number; at: Point } | null = null;
    for (let i = 0; i < n && !clip; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const at = segmentIntersection(
          result[i],
          result[i + 1],
          result[j],
          result[(j + 1) % n],
        );
        if (at) {
          clip = { i, j, at };
          break;
        }
      }
    }
    if (!clip) break;
    result =
      (clip.j - clip.i) * 2 <= n
        ? [...result.slice(0, clip.i + 1), clip.at, ...result.slice(clip.j + 1)]
        : [clip.at, ...result.slice(clip.i + 1, clip.j + 1)];
  }
  return result;
}

function offsetOutline(poly: Point[], pad: number): Point[] {
  const n = poly.length;
  const area = poly.reduce((s, a, i) => {
    const b = poly[(i + 1) % n];
    return s + (a.x * b.y - b.x * a.y);
  }, 0);
  const outSign = area > 0 ? -1 : 1;

  const norm = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    return { x: (outSign * -ey) / len, y: (outSign * ex) / len };
  });

  const raw: Point[] = [];
  const arc = (
    cx: number,
    cy: number,
    startA: number,
    sweep: number,
    r: number,
  ) => {
    const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP));
    for (let s = 0; s <= steps; s++) {
      const ang = startA + (sweep * s) / steps;
      raw.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
  };

  for (let i = 0; i < n; i++) {
    const prev = norm[(i - 1 + n) % n];
    const curr = norm[i];
    const v = poly[i];
    const cross = prev.x * curr.y - prev.y * curr.x;
    const sweep = Math.atan2(cross, prev.x * curr.x + prev.y * curr.y);
    const convex = outSign < 0 ? sweep > 1e-6 : sweep < -1e-6;
    const startA = Math.atan2(prev.y, prev.x);
    if (convex) {
      arc(v.x, v.y, startA, sweep, pad);
      continue;
    }
    const p = poly[(i - 1 + n) % n];
    const q = poly[(i + 1) % n];
    const e1 = { x: v.x + prev.x * pad, y: v.y + prev.y * pad };
    const e2 = { x: v.x + curr.x * pad, y: v.y + curr.y * pad };
    const hit = lineIntersection(
      { x: p.x + prev.x * pad, y: p.y + prev.y * pad },
      e1,
      e2,
      { x: q.x + curr.x * pad, y: q.y + curr.y * pad },
    );
    if (Math.hypot(hit.x - v.x, hit.y - v.y) > MITER_CAP * pad) {
      arc(v.x, v.y, startA, sweep, pad);
      continue;
    }
    const inLen = Math.hypot(v.x - p.x, v.y - p.y) || 1;
    const outLen = Math.hypot(q.x - v.x, q.y - v.y) || 1;
    const din = { x: (v.x - p.x) / inLen, y: (v.y - p.y) / inLen };
    const dout = { x: (q.x - v.x) / outLen, y: (q.y - v.y) / outLen };
    const half =
      (Math.PI -
        Math.abs(
          Math.atan2(
            din.x * dout.y - din.y * dout.x,
            din.x * dout.x + din.y * dout.y,
          ),
        )) /
      2;
    const tanHalf = Math.tan(half);
    const limit =
      Math.min(
        Math.hypot(hit.x - e1.x, hit.y - e1.y),
        Math.hypot(hit.x - e2.x, hit.y - e2.y),
      ) * 0.7;
    const setback = Math.min((pad * REFLEX_FILLET) / (tanHalf || 1e-6), limit);
    if (setback < 0.5) {
      raw.push(hit);
      continue;
    }
    const r = setback * tanHalf;
    const bx = dout.x - din.x;
    const by = dout.y - din.y;
    const blen = Math.hypot(bx, by) || 1;
    const dc = setback / Math.cos(half);
    const c = { x: hit.x + (bx / blen) * dc, y: hit.y + (by / blen) * dc };
    const t1 = { x: hit.x - din.x * setback, y: hit.y - din.y * setback };
    const a1 = Math.atan2(t1.y - c.y, t1.x - c.x);
    const t2 = { x: hit.x + dout.x * setback, y: hit.y + dout.y * setback };
    let d = Math.atan2(t2.y - c.y, t2.x - c.x) - a1;
    d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    arc(c.x, c.y, a1, d, r);
  }
  return removeLoops(raw);
}

export function getScales(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgDims: { w: number; h: number },
) {
  return computeScales(canvasW, canvasH, zoom, imgDims.w, imgDims.h);
}

export function getScreenOffset(
  canvasW: number,
  canvasH: number,
  zoom: number,
  panX: number,
  panY: number,
  imgDims: { w: number; h: number },
) {
  return computeScreenOffset(
    canvasW,
    canvasH,
    zoom,
    imgDims.w,
    imgDims.h,
    panX,
    panY,
  );
}

export function easeOutCubic(progress: number): number {
  const remaining = 1 - progress;
  return 1 - remaining * remaining * remaining;
}

export function getTerritoryScreenPos(
  t: Point,
  size: { w: number; h: number },
  transform: Transform,
  imgDims: { w: number; h: number },
): Point {
  const { scaleX, scaleY } = getScales(size.w, size.h, transform.zoom, imgDims);
  const { x: offsetX, y: offsetY } = getScreenOffset(
    size.w,
    size.h,
    transform.zoom,
    transform.offsetX,
    transform.offsetY,
    imgDims,
  );
  return { x: t.x * scaleX + offsetX, y: t.y * scaleY + offsetY };
}

export function computeTooltipLabels(
  tooltipTerritoryId: number | null,
  portalTerritoryIds: number[],
  radiationById: Set<number>,
  visibleTerritoryById: Set<number> | null,
  ownerById: Map<number, { isCapital: boolean; entrenchedTurns: number }>,
  toxinById: Set<number>,
): string[] {
  const tooltipLabels: string[] = [];
  if (tooltipTerritoryId === null) return tooltipLabels;
  if (portalTerritoryIds.includes(tooltipTerritoryId))
    tooltipLabels.push('Portal');
  if (radiationById.has(tooltipTerritoryId)) tooltipLabels.push('Radiation');
  if (
    visibleTerritoryById === null ||
    visibleTerritoryById.has(tooltipTerritoryId)
  ) {
    const tooltipOwner = ownerById.get(tooltipTerritoryId);
    if (tooltipOwner?.isCapital) tooltipLabels.push('Capital');
    if ((tooltipOwner?.entrenchedTurns ?? 0) > 0)
      tooltipLabels.push('Entrenched');
    if (toxinById.has(tooltipTerritoryId)) tooltipLabels.push('Toxin');
  } else {
    tooltipLabels.push('Fog');
  }
  return tooltipLabels;
}

function drawCapsulePath(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  pad: number,
) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey) || 1;
  const nx = -ey / len;
  const ny = ex / len;
  const angle = Math.atan2(ey, ex);
  ctx.moveTo(a.x + nx * pad, a.y + ny * pad);
  ctx.lineTo(b.x + nx * pad, b.y + ny * pad);
  ctx.arc(b.x, b.y, pad, angle + Math.PI / 2, angle - Math.PI / 2, true);
  ctx.lineTo(a.x - nx * pad, a.y - ny * pad);
  ctx.arc(a.x, a.y, pad, angle - Math.PI / 2, angle + Math.PI / 2, true);
  ctx.closePath();
}

const concaveHullCache = new Map<string, Point[]>();

function cachedConcaveHull(
  territories: Territory[],
  isAdjacent: (i: number, j: number) => boolean,
): Point[] {
  const key = territories.map((t) => `${t.id}:${t.x}:${t.y}`).join('|');
  let hull = concaveHullCache.get(key);
  if (!hull) {
    hull = concaveHull(territories, isAdjacent);
    concaveHullCache.set(key, hull);
  }
  return hull;
}

export function strokeContinentOutline(
  ctx: CanvasRenderingContext2D,
  territories: Territory[],
  toScreen: (p: Point) => Point,
  pad: number,
) {
  const isAdjacent = (i: number, j: number) =>
    territories[i].neighbors.includes(territories[j].id) ||
    territories[j].neighbors.includes(territories[i].id);
  const hull = convexHull(territories);
  ctx.beginPath();
  if (hull.length === 1) {
    const p = toScreen(hull[0]);
    ctx.arc(p.x, p.y, pad, 0, Math.PI * 2);
  } else if (hull.length === 2) {
    drawCapsulePath(ctx, toScreen(hull[0]), toScreen(hull[1]), pad);
  } else {
    const pts = offsetOutline(
      cachedConcaveHull(territories, isAdjacent).map(toScreen),
      pad,
    );
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}
