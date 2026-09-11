import {
  DUNGEON_SEAM_COLOR,
  DUNGEON_TONES,
  DUNGEON_VOID_COLOR,
  DUNGEON_WALL_COLOR,
  EARTH_TONES,
  TEMPLE_SEAM_COLOR,
  TEMPLE_TONES,
  TEMPLE_VOID_COLOR,
  TEMPLE_WALL_COLOR,
  WATER_COLOR,
} from 'engine';

export type PaintTool =
  | 'pencil'
  | 'eraser'
  | 'line'
  | 'curve'
  | 'rect'
  | 'ellipse'
  | 'fill'
  | 'sampler';

export type ShapeKind = 'rect' | 'ellipse';

export const ERASER_COLOR = '#ffffff';

export interface PaletteGroup {
  label: string;
  colors: string[];
}

export const PALETTE_GROUPS: PaletteGroup[] = [
  { label: 'Basic', colors: ['#000000', '#ffffff'] },
  { label: 'Terrain', colors: [...EARTH_TONES, WATER_COLOR] },
  {
    label: 'Dungeon',
    colors: [
      ...DUNGEON_TONES,
      DUNGEON_WALL_COLOR,
      DUNGEON_VOID_COLOR,
      DUNGEON_SEAM_COLOR,
    ],
  },
  {
    label: 'Temple',
    colors: [
      ...TEMPLE_TONES,
      TEMPLE_WALL_COLOR,
      TEMPLE_VOID_COLOR,
      TEMPLE_SEAM_COLOR,
    ],
  },
];

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function paintContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  return canvas.getContext('2d');
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function sampleColor(s: ImageData, x: number, y: number): string | null {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= s.width || iy >= s.height) return null;
  const i = (iy * s.width + ix) * 4;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(s.data[i])}${hex(s.data[i + 1])}${hex(s.data[i + 2])}`;
}

function fillRow(
  s: ImageData,
  xa: number,
  xb: number,
  y: number,
  r: number,
  g: number,
  b: number,
): void {
  if (y < 0 || y >= s.height) return;
  const lo = Math.max(0, xa);
  const hi = Math.min(s.width, xb);
  let i = (y * s.width + lo) * 4;
  for (let x = lo; x < hi; x++) {
    s.data[i] = r;
    s.data[i + 1] = g;
    s.data[i + 2] = b;
    s.data[i + 3] = 255;
    i += 4;
  }
}

function fillBlock(
  s: ImageData,
  x: number,
  y: number,
  px: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let yy = y; yy < y + px; yy++) fillRow(s, x, x + px, yy, r, g, b);
}

function thinSegment(
  s: ImageData,
  a: Point,
  b: Point,
  px: number,
  r: number,
  g: number,
  bl: number,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillBlock(
      s,
      Math.round(a.x + dx * t) - (px >> 1),
      Math.round(a.y + dy * t) - (px >> 1),
      px,
      r,
      g,
      bl,
    );
  }
}

function capsule(
  s: ImageData,
  a: Point,
  b: Point,
  radius: number,
  r: number,
  g: number,
  bl: number,
): void {
  const rad = Math.max(0.5, radius);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ox = len > 0 ? (-dy / len) * rad : 0;
  const oy = len > 0 ? (dx / len) * rad : 0;
  const poly = [
    { x: a.x + ox, y: a.y + oy },
    { x: b.x + ox, y: b.y + oy },
    { x: b.x - ox, y: b.y - oy },
    { x: a.x - ox, y: a.y - oy },
  ];
  const top = Math.floor(Math.min(a.y, b.y) - rad);
  const bottom = Math.ceil(Math.max(a.y, b.y) + rad);
  for (let y = top; y <= bottom; y++) {
    const yy = y + 0.5;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 4; i++) {
      const p = poly[i];
      const q = poly[(i + 1) & 3];
      if (p.y === q.y) continue;
      const t = (yy - p.y) / (q.y - p.y);
      if (t < 0 || t > 1) continue;
      const x = p.x + t * (q.x - p.x);
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    for (const cap of [a, b]) {
      const gap = rad * rad - (yy - cap.y) * (yy - cap.y);
      if (gap < 0) continue;
      const w = Math.sqrt(gap);
      if (cap.x - w < lo) lo = cap.x - w;
      if (cap.x + w > hi) hi = cap.x + w;
    }
    if (hi >= lo) {
      const xa = Math.round(lo);
      fillRow(s, xa, Math.max(xa + 1, Math.round(hi)), y, r, g, bl);
    }
  }
}

function segment(
  s: ImageData,
  a: Point,
  b: Point,
  size: number,
  r: number,
  g: number,
  bl: number,
): void {
  const d = Math.round(size);
  if (d <= 2) thinSegment(s, a, b, Math.max(1, d), r, g, bl);
  else capsule(s, a, b, size / 2, r, g, bl);
}

function boundsOf(points: Point[], pad: number, s: ImageData): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const x = Math.max(0, Math.floor(minX - pad));
  const y = Math.max(0, Math.floor(minY - pad));
  const w = Math.min(s.width, Math.ceil(maxX + pad)) - x;
  const h = Math.min(s.height, Math.ceil(maxY + pad)) - y;
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
}

function disc(
  s: ImageData,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  bl: number,
): void {
  const rad = Math.max(0.5, radius);
  const top = Math.floor(cy - rad);
  const bottom = Math.ceil(cy + rad);
  for (let y = top; y <= bottom; y++) {
    const dy = y + 0.5 - cy;
    const gap = rad * rad - dy * dy;
    if (gap < 0) continue;
    const dx = Math.sqrt(gap);
    const xa = Math.round(cx - dx);
    fillRow(s, xa, Math.max(xa + 1, Math.round(cx + dx)), y, r, g, bl);
  }
}

function dottedSegment(
  s: ImageData,
  a: Point,
  b: Point,
  size: number,
  r: number,
  g: number,
  bl: number,
  carry: number,
): number {
  const period = Math.max(4, Math.round(size) * 2);
  const radius = size / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) {
    if (carry <= 0) disc(s, a.x, a.y, radius, r, g, bl);
    return carry;
  }
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  let d = carry;
  while (d <= len) {
    disc(s, a.x + ux * d, a.y + uy * d, radius, r, g, bl);
    d += period;
  }
  return d - len;
}

function dottedPath(
  s: ImageData,
  points: Point[],
  size: number,
  r: number,
  g: number,
  bl: number,
  closed: boolean,
): void {
  if (points.length === 1) {
    disc(s, points[0].x, points[0].y, size / 2, r, g, bl);
    return;
  }
  let carry = 0;
  for (let i = 1; i < points.length; i++)
    carry = dottedSegment(s, points[i - 1], points[i], size, r, g, bl, carry);
  if (closed && points.length > 2)
    dottedSegment(
      s,
      points[points.length - 1],
      points[0],
      size,
      r,
      g,
      bl,
      carry,
    );
}

function solidPath(
  s: ImageData,
  points: Point[],
  size: number,
  r: number,
  g: number,
  bl: number,
  closed: boolean,
): void {
  for (let i = 1; i < points.length; i++)
    segment(s, points[i - 1], points[i], size, r, g, bl);
  if (closed && points.length > 2)
    segment(s, points[points.length - 1], points[0], size, r, g, bl);
}

function ellipsePerimeter(
  left: number,
  top: number,
  rw: number,
  rh: number,
): Point[] {
  const cx = left + rw / 2;
  const cy = top + rh / 2;
  const rx = rw / 2;
  const ry = rh / 2;
  const steps = Math.min(360, Math.max(24, Math.ceil((rx + ry) * 1.5)));
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return pts;
}

export function drawFreehand(
  s: ImageData,
  tool: PaintTool,
  color: string,
  size: number,
  points: Point[],
  dotted = false,
): Rect {
  const [r, g, b] = hexToRgb(tool === 'eraser' ? ERASER_COLOR : color);
  if (dotted && tool !== 'eraser') {
    dottedPath(s, points, size, r, g, b, false);
  } else if (points.length === 1) {
    segment(s, points[0], points[0], size, r, g, b);
  } else {
    for (let i = 1; i < points.length; i++)
      segment(s, points[i - 1], points[i], size, r, g, b);
  }
  return boundsOf(points, size / 2 + 2, s);
}

export function drawFreehandDot(
  s: ImageData,
  color: string,
  size: number,
  a: Point,
  b: Point,
  carry: number,
): { carry: number; rect: Rect } {
  const [r, g, bl] = hexToRgb(color);
  const next = dottedSegment(s, a, b, size, r, g, bl, carry);
  return { carry: next, rect: boundsOf([a, b], size / 2 + 2, s) };
}

export function drawLine(
  s: ImageData,
  color: string,
  size: number,
  a: Point,
  b: Point,
  dotted = false,
): Rect {
  const [r, g, bl] = hexToRgb(color);
  if (dotted) dottedPath(s, [a, b], size, r, g, bl, false);
  else segment(s, a, b, size, r, g, bl);
  return boundsOf([a, b], size / 2 + 2, s);
}

export function drawCurve(
  s: ImageData,
  color: string,
  size: number,
  a: Point,
  b: Point,
  control: Point,
  dotted = false,
): Rect {
  const [r, g, bl] = hexToRgb(color);
  const approxLength =
    Math.hypot(control.x - a.x, control.y - a.y) +
    Math.hypot(b.x - control.x, b.y - control.y);
  const steps = Math.max(8, Math.min(400, Math.ceil(approxLength / 4)));
  const samples: Point[] = [a];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    samples.push({
      x: mt * mt * a.x + 2 * mt * t * control.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * control.y + t * t * b.y,
    });
  }
  if (dotted) dottedPath(s, samples, size, r, g, bl, false);
  else solidPath(s, samples, size, r, g, bl, false);
  return boundsOf([a, b, control], size / 2 + 2, s);
}

export function drawShape(
  s: ImageData,
  kind: ShapeKind,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  filled: boolean,
  dotted: boolean,
): Rect {
  const left = Math.round(Math.min(x, x + w));
  const top = Math.round(Math.min(y, y + h));
  const rw = Math.round(Math.abs(w));
  const rh = Math.round(Math.abs(h));
  if (rw < 1 || rh < 1) return { x: 0, y: 0, w: 0, h: 0 };
  const [r, g, b] = hexToRgb(color);
  if (filled && kind === 'rect') {
    for (let py = top; py < top + rh; py++)
      fillRow(s, left, left + rw, py, r, g, b);
  } else if (filled) {
    const cx = left + rw / 2;
    const cy = top + rh / 2;
    const rx = rw / 2;
    const ry = rh / 2;
    for (let py = top; py < top + rh; py++) {
      const ndy = (py + 0.5 - cy) / ry;
      if (ndy * ndy >= 1) continue;
      const span = rx * Math.sqrt(1 - ndy * ndy);
      const xa = Math.round(cx - span);
      fillRow(s, xa, Math.max(xa + 1, Math.round(cx + span)), py, r, g, b);
    }
  } else {
    const pts =
      kind === 'rect'
        ? [
            { x: left, y: top },
            { x: left + rw, y: top },
            { x: left + rw, y: top + rh },
            { x: left, y: top + rh },
          ]
        : ellipsePerimeter(left, top, rw, rh);
    if (dotted) dottedPath(s, pts, size, r, g, b, true);
    else solidPath(s, pts, size, r, g, b, true);
  }
  const pad = filled ? 0 : Math.ceil(size / 2) + 2;
  const bx = Math.max(0, left - pad);
  const by = Math.max(0, top - pad);
  return {
    x: bx,
    y: by,
    w: Math.min(s.width, left + rw + pad) - bx,
    h: Math.min(s.height, top + rh + pad) - by,
  };
}

export function floodFill(
  s: ImageData,
  startX: number,
  startY: number,
  color: string,
): void {
  const { data, width, height } = s;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;
  const start = (y0 * width + x0) * 4;
  const tr = data[start];
  const tg = data[start + 1];
  const tb = data[start + 2];
  const ta = data[start + 3];
  const [fr, fg, fb] = hexToRgb(color);
  if (tr === fr && tg === fg && tb === fb && ta === 255) return;
  const visited = new Uint8Array(width * height);
  const startP = y0 * width + x0;
  visited[startP] = 1;
  const stack = [startP];
  while (stack.length > 0) {
    const p = stack.pop()!;
    const i = p * 4;
    if (
      data[i] !== tr ||
      data[i + 1] !== tg ||
      data[i + 2] !== tb ||
      data[i + 3] !== ta
    )
      continue;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0 && !visited[p - 1]) {
      visited[p - 1] = 1;
      stack.push(p - 1);
    }
    if (x < width - 1 && !visited[p + 1]) {
      visited[p + 1] = 1;
      stack.push(p + 1);
    }
    if (y > 0 && !visited[p - width]) {
      visited[p - width] = 1;
      stack.push(p - width);
    }
    if (y < height - 1 && !visited[p + width]) {
      visited[p + width] = 1;
      stack.push(p + width);
    }
  }
}
