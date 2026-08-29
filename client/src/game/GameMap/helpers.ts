import {
  getClampedOffset as computeClampedOffset,
  getScales as computeScales,
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
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 10;
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

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

function drawConvexOffsetPath(
  ctx: CanvasRenderingContext2D,
  hull: Point[],
  pad: number,
) {
  const n = hull.length;
  const centroid = {
    x: hull.reduce((s, p) => s + p.x, 0) / n,
    y: hull.reduce((s, p) => s + p.y, 0) / n,
  };
  const offsetEdges = hull.map((a, i) => {
    const b = hull[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    let nx = -ey / len;
    let ny = ex / len;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((mid.x - centroid.x) * nx + (mid.y - centroid.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return {
      a: { x: a.x + nx * pad, y: a.y + ny * pad },
      b: { x: b.x + nx * pad, y: b.y + ny * pad },
    };
  });

  const arcAngles = (i: number) => {
    const vertex = hull[i];
    const from = offsetEdges[(i - 1 + n) % n].b;
    const to = offsetEdges[i].a;
    return {
      start: Math.atan2(from.y - vertex.y, from.x - vertex.x),
      end: Math.atan2(to.y - vertex.y, to.x - vertex.x),
    };
  };
  const firstAngles = arcAngles(0);
  const anticlockwise =
    normalizeAngle(firstAngles.end - firstAngles.start) > Math.PI;

  ctx.moveTo(offsetEdges[n - 1].b.x, offsetEdges[n - 1].b.y);
  for (let i = 0; i < n; i++) {
    const { start, end } = arcAngles(i);
    ctx.arc(hull[i].x, hull[i].y, pad, start, end, anticlockwise);
    ctx.lineTo(offsetEdges[i].b.x, offsetEdges[i].b.y);
  }
  ctx.closePath();
}

export function getScales(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgDims: { w: number; h: number },
) {
  return computeScales(canvasW, canvasH, zoom, imgDims.w, imgDims.h);
}

export function getClampedOffset(
  canvasW: number,
  canvasH: number,
  zoom: number,
  x: number,
  y: number,
  imgDims: { w: number; h: number },
) {
  return computeClampedOffset(
    canvasW,
    canvasH,
    zoom,
    imgDims.w,
    imgDims.h,
    x,
    y,
  );
}

export function getTerritoryScreenPos(
  t: Point,
  size: { w: number; h: number },
  transform: Transform,
  imgDims: { w: number; h: number },
): Point {
  const { scaleX, scaleY } = getScales(size.w, size.h, transform.zoom, imgDims);
  const { x: offsetX, y: offsetY } = getClampedOffset(
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

export function strokeContinentOutline(
  ctx: CanvasRenderingContext2D,
  screenPoints: Point[],
  pad: number,
) {
  if (screenPoints.length === 1) {
    ctx.beginPath();
    ctx.arc(screenPoints[0].x, screenPoints[0].y, pad, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (screenPoints.length === 2) {
    const savedLineWidth = ctx.lineWidth;
    const savedLineCap = ctx.lineCap;
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = pad * 2;
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
    ctx.stroke();
    ctx.lineWidth = savedLineWidth;
    ctx.lineCap = savedLineCap;
    return;
  }
  const hull = convexHull(screenPoints);
  ctx.beginPath();
  drawConvexOffsetPath(ctx, hull, pad);
  ctx.stroke();
}
