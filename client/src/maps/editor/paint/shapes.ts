import { CURSOR_GRAB } from '../../../ui/cursors/cursors';
import { drawPolygon, type Point } from './paintTools';

export type ShapeKind =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'pentagon'
  | 'hexagon'
  | 'heptagon'
  | 'octagon'
  | 'nonagon'
  | 'decagon'
  | 'hendecagon'
  | 'dodecagon';

const POLYGON_SIDES: Record<Exclude<ShapeKind, 'circle'>, number> = {
  triangle: 3,
  square: 4,
  pentagon: 5,
  hexagon: 6,
  heptagon: 7,
  octagon: 8,
  nonagon: 9,
  decagon: 10,
  hendecagon: 11,
  dodecagon: 12,
};

export const SHAPE_KINDS: ShapeKind[] = [
  'circle',
  ...(Object.keys(POLYGON_SIDES) as ShapeKind[]),
];

export interface Shape {
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
  size: number;
  filled: boolean;
  dotted: boolean;
}

export type ShapeDrag =
  | { mode: 'create'; start: Point; last: Point }
  | { mode: 'move'; start: Point; from: Shape }
  | { mode: 'resize'; handle: number; from: Shape }
  | { mode: 'rotate'; start: Point; from: Shape };

interface Extent {
  l: number;
  t: number;
  r: number;
  b: number;
}

export const ROTATE_HANDLE = 8;
const ROTATE_OFFSET = 40;
const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
const HANDLE_ANGLES = [225, 315, 45, 135, 270, 0, 90, 180];
const CHROME_COLOR = '#1e88e5';
const HANDLE_SIZE = 5;
const HANDLE_REACH = 20;
const SNAP_STEPS = [30, 45];
const SNAP_DEGREES = 4;

function extentOf(points: Point[]): Extent {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    l: Math.min(...xs),
    t: Math.min(...ys),
    r: Math.max(...xs),
    b: Math.max(...ys),
  };
}

function rotate(p: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

function center(s: Shape): Point {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

function toWorld(s: Shape, p: Point): Point {
  const c = center(s);
  const r = rotate(p, s.rotation);
  return { x: c.x + r.x, y: c.y + r.y };
}

function toLocal(s: Shape, p: Point): Point {
  const c = center(s);
  return rotate({ x: p.x - c.x, y: p.y - c.y }, -s.rotation);
}

function unitPolygon(sides: number): Point[] {
  const start = -Math.PI / 2 + (sides % 2 === 0 ? Math.PI / sides : 0);
  const points: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const a = start + (i / sides) * Math.PI * 2;
    points.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return points;
}

function polygonPoints(sides: number, w: number, h: number): Point[] {
  const points = unitPolygon(sides);
  const e = extentOf(points);
  return points.map((p) => ({
    x: ((p.x - e.l) / (e.r - e.l) - 0.5) * w,
    y: ((p.y - e.t) / (e.b - e.t) - 0.5) * h,
  }));
}

function ellipsePoints(w: number, h: number): Point[] {
  const rx = w / 2;
  const ry = h / 2;
  const steps = Math.min(360, Math.max(24, Math.ceil((rx + ry) * 1.5)));
  const points: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    points.push({ x: rx * Math.cos(t), y: ry * Math.sin(t) });
  }
  return points;
}

export function shapeSides(kind: ShapeKind): number | null {
  return kind === 'circle' ? null : POLYGON_SIDES[kind];
}

export function outlinePoints(kind: ShapeKind, w: number, h: number): Point[] {
  return kind === 'circle'
    ? ellipsePoints(w, h)
    : polygonPoints(POLYGON_SIDES[kind], w, h);
}

export function shapeAspect(kind: ShapeKind): number {
  if (kind === 'circle') return 1;
  const e = extentOf(unitPolygon(POLYGON_SIDES[kind]));
  return (e.r - e.l) / (e.b - e.t);
}

export function drawShape(surface: ImageData, s: Shape): void {
  const left = Math.round(Math.min(s.x, s.x + s.w));
  const top = Math.round(Math.min(s.y, s.y + s.h));
  const w = Math.round(Math.abs(s.w));
  const h = Math.round(Math.abs(s.h));
  if (w < 1 || h < 1) return;
  const c = { x: left + w / 2, y: top + h / 2 };
  const points = outlinePoints(s.kind, w, h).map((p) => {
    const r = rotate(p, s.rotation);
    return { x: c.x + r.x, y: c.y + r.y };
  });
  drawPolygon(surface, s.color, points, s.size, s.filled, s.dotted);
}

function localHandles(s: Shape, scale: number): Point[] {
  const hw = Math.abs(s.w) / 2;
  const hh = Math.abs(s.h) / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
    { x: 0, y: -hh },
    { x: hw, y: 0 },
    { x: 0, y: hh },
    { x: -hw, y: 0 },
    { x: 0, y: -hh - ROTATE_OFFSET / scale },
  ];
}

export function shapeExtent(s: Shape, scale: number): Extent {
  return extentOf(localHandles(s, scale).map((p) => toWorld(s, p)));
}

function within(p: Point, target: Point, reach: number): boolean {
  return Math.abs(p.x - target.x) <= reach && Math.abs(p.y - target.y) <= reach;
}

export function nearHandle(p: Point, handle: Point, scale: number): boolean {
  return within(p, handle, HANDLE_REACH / scale);
}

export function hitHandle(s: Shape, p: Point, scale: number): number {
  const q = toLocal(s, p);
  const reach = HANDLE_REACH / scale;
  const boxReach = Math.min(reach, Math.min(Math.abs(s.w), Math.abs(s.h)) / 4);
  return localHandles(s, scale).findIndex((h, i) =>
    within(q, h, i === ROTATE_HANDLE ? reach : boxReach),
  );
}

export function insideShape(s: Shape, p: Point): boolean {
  const q = toLocal(s, p);
  return (
    Math.abs(q.x) <= Math.abs(s.w) / 2 && Math.abs(q.y) <= Math.abs(s.h) / 2
  );
}

export function handleCursor(s: Shape, handle: number): string {
  if (handle === ROTATE_HANDLE) return CURSOR_GRAB;
  const angle = HANDLE_ANGLES[handle] + (s.rotation * 180) / Math.PI;
  const step = Math.round(angle / 45) % 4;
  return RESIZE_CURSORS[(step + 4) % 4];
}

export function drawHandle(
  c: CanvasRenderingContext2D,
  p: Point,
  scale: number,
): void {
  const hs = HANDLE_SIZE / scale;
  c.fillStyle = CHROME_COLOR;
  c.fillRect(p.x - hs, p.y - hs, hs * 2, hs * 2);
}

export function drawChrome(
  c: CanvasRenderingContext2D,
  s: Shape,
  scale: number,
): void {
  const hw = Math.abs(s.w) / 2;
  const hh = Math.abs(s.h) / 2;
  const hs = HANDLE_SIZE / scale;
  const handles = localHandles(s, scale);
  const knob = handles[ROTATE_HANDLE];
  const mid = center(s);
  c.save();
  c.translate(mid.x, mid.y);
  c.rotate(s.rotation);
  c.strokeStyle = CHROME_COLOR;
  c.lineWidth = 1 / scale;
  c.setLineDash([4 / scale, 3 / scale]);
  c.strokeRect(-hw, -hh, hw * 2, hh * 2);
  c.setLineDash([]);
  c.beginPath();
  c.moveTo(0, -hh);
  c.lineTo(knob.x, knob.y);
  c.stroke();
  for (const p of handles.slice(0, ROTATE_HANDLE)) drawHandle(c, p, scale);
  c.beginPath();
  c.arc(knob.x, knob.y, hs, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export function computeCreate(
  start: Point,
  cur: Point,
  shift: boolean,
  alt: boolean,
  aspect: number,
): { x: number; y: number; w: number; h: number } {
  let dx = cur.x - start.x;
  let dy = cur.y - start.y;
  if (shift) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax >= ay * aspect) dy = ((dy < 0 ? -1 : 1) * ax) / aspect;
    else dx = (dx < 0 ? -1 : 1) * ay * aspect;
  }
  if (alt) {
    return { x: start.x - dx, y: start.y - dy, w: dx * 2, h: dy * 2 };
  }
  return { x: start.x, y: start.y, w: dx, h: dy };
}

export function resizeShape(from: Shape, handle: number, p: Point): Shape {
  const q = toLocal(from, p);
  const hw = Math.abs(from.w) / 2;
  const hh = Math.abs(from.h) / 2;
  let l = -hw;
  let t = -hh;
  let r = hw;
  let b = hh;
  if (handle === 0 || handle === 3 || handle === 7) l = q.x;
  if (handle === 1 || handle === 2 || handle === 5) r = q.x;
  if (handle === 0 || handle === 1 || handle === 4) t = q.y;
  if (handle === 2 || handle === 3 || handle === 6) b = q.y;
  const mid = toWorld(from, { x: (l + r) / 2, y: (t + b) / 2 });
  const w = r - l;
  const h = b - t;
  return { ...from, x: mid.x - w / 2, y: mid.y - h / 2, w, h };
}

export function rotateShape(from: Shape, start: Point, p: Point): Shape {
  const c = center(from);
  const delta =
    Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(start.y - c.y, start.x - c.x);
  return { ...from, rotation: snapRotation(from.rotation + delta) };
}

function snapRotation(rotation: number): number {
  const degrees = (rotation * 180) / Math.PI;
  for (const step of SNAP_STEPS) {
    const target = Math.round(degrees / step) * step;
    if (Math.abs(degrees - target) <= SNAP_DEGREES)
      return (target * Math.PI) / 180;
  }
  return rotation;
}

export function rotationDegrees(s: Shape): number {
  const degrees = Math.round((s.rotation * 180) / Math.PI);
  return ((degrees % 360) + 360) % 360;
}
