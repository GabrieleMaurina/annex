import type { MutableRefObject } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  drawCurve,
  drawFreehand,
  drawFreehandDot,
  drawLine,
  drawShape,
  ERASER_COLOR,
  floodFill,
  paintContext,
  sampleColor,
  type PaintTool,
  type Point,
  type Rect,
  type ShapeKind,
} from './paintTools';

export interface Viewport {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export interface Shape {
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  size: number;
  filled: boolean;
  dotted: boolean;
}

type ShapeDrag =
  | { mode: 'create'; start: Point; last: Point }
  | { mode: 'move'; start: Point; from: Shape }
  | { mode: 'resize'; handle: number; from: Shape };

export interface PaintLayerHandle {
  flush: () => void;
  serializeShape: () => Shape | null;
  getBasePixels: () => Uint8ClampedArray | null;
  adopt: (shape: Shape) => void;
}

interface Props {
  paintCanvas: HTMLCanvasElement;
  surfaceRef: MutableRefObject<ImageData>;
  viewportRef: MutableRefObject<Viewport>;
  tool: PaintTool;
  color: string;
  size: number;
  dotted: boolean;
  filled: boolean;
  epoch: number;
  onStrokeEnd: () => void;
  onChange: () => void;
  onWheelZoom: (clientX: number, clientY: number, deltaY: number) => void;
  onPickColor: (hex: string) => void;
}

const HANDLE_CURSOR = [
  'nwse-resize',
  'nesw-resize',
  'nwse-resize',
  'nesw-resize',
  'ns-resize',
  'ew-resize',
  'ns-resize',
  'ew-resize',
];

function bounds(s: Shape): { l: number; t: number; r: number; b: number } {
  return {
    l: Math.min(s.x, s.x + s.w),
    t: Math.min(s.y, s.y + s.h),
    r: Math.max(s.x, s.x + s.w),
    b: Math.max(s.y, s.y + s.h),
  };
}

function handlePoints(s: Shape): Point[] {
  const { l, t, r, b } = bounds(s);
  const mx = (l + r) / 2;
  const my = (t + b) / 2;
  return [
    { x: l, y: t },
    { x: r, y: t },
    { x: r, y: b },
    { x: l, y: b },
    { x: mx, y: t },
    { x: r, y: my },
    { x: mx, y: b },
    { x: l, y: my },
  ];
}

function computeCreate(
  start: Point,
  cur: Point,
  shift: boolean,
  alt: boolean,
): { x: number; y: number; w: number; h: number } {
  let dx = cur.x - start.x;
  let dy = cur.y - start.y;
  if (shift) {
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * m;
    dy = (dy < 0 ? -1 : 1) * m;
  }
  if (alt) {
    return { x: start.x - dx, y: start.y - dy, w: dx * 2, h: dy * 2 };
  }
  return { x: start.x, y: start.y, w: dx, h: dy };
}

function drawChrome(
  c: CanvasRenderingContext2D,
  s: Shape,
  scale: number,
): void {
  const { l, t, r, b } = bounds(s);
  const hs = 5 / scale;
  c.save();
  c.strokeStyle = '#1e88e5';
  c.lineWidth = 1 / scale;
  c.setLineDash([4 / scale, 3 / scale]);
  c.strokeRect(l, t, r - l, b - t);
  c.setLineDash([]);
  c.fillStyle = '#1e88e5';
  for (const p of handlePoints(s))
    c.fillRect(p.x - hs, p.y - hs, hs * 2, hs * 2);
  c.restore();
}

const BRUSH_TOOLS: PaintTool[] = ['pencil', 'line', 'curve', 'eraser'];

function brushCursor(color: string, diameter: number): string {
  const d = Math.round(diameter);
  if (d < 10 || d > 128) return 'crosshair';
  const c = d / 2;
  const r = (d - 2) / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="${color}"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`;
}

const PaintLayer = forwardRef<PaintLayerHandle, Props>(function PaintLayer(
  {
    paintCanvas,
    surfaceRef,
    viewportRef,
    tool,
    color,
    size,
    dotted,
    filled,
    epoch,
    onStrokeEnd,
    onChange,
    onWheelZoom,
    onPickColor,
  },
  ref,
) {
  const surface = surfaceRef.current;
  const divRef = useRef<HTMLDivElement>(null);
  const samplingRef = useRef(false);
  const snapshotRef = useRef<Uint8ClampedArray | null>(null);
  const freehandRef = useRef<{ active: boolean; points: Point[] }>({
    active: false,
    points: [],
  });
  const dotCarryRef = useRef(0);
  const lineRef = useRef<{ active: boolean; a: Point } | null>(null);
  const curveRef = useRef<{
    phase: 'idle' | 'awaitControl' | 'control';
    a: Point;
    b: Point;
  }>({ phase: 'idle', a: { x: 0, y: 0 }, b: { x: 0, y: 0 } });
  const eraseRef = useRef<{ active: boolean; points: Point[] }>({
    active: false,
    points: [],
  });
  const shapeRef = useRef<Shape | null>(null);
  const shapeDragRef = useRef<ShapeDrag | null>(null);
  const colorRef = useRef(color);
  const cursorRef = useRef('crosshair');
  const dirtyRef = useRef<Rect | 'full' | null>(null);
  const rafRef = useRef(0);
  const previewRectRef = useRef<Rect | null>(null);

  useEffect(() => {
    colorRef.current = color;
    if (shapeRef.current) {
      shapeRef.current = { ...shapeRef.current, color };
      renderShape();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  useEffect(() => {
    if (shapeRef.current) {
      shapeRef.current = { ...shapeRef.current, size, filled, dotted };
      renderShape();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, filled, dotted]);

  useEffect(() => {
    discardTransient();
    curveRef.current.phase = 'idle';
    lineRef.current = null;
    freehandRef.current.active = false;
    eraseRef.current.active = false;
    samplingRef.current = false;
    shapeDragRef.current = null;
    snapshotRef.current = null;
    flushDisplay();
    applyCursor(resolveCursor());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  useEffect(() => {
    applyCursor(resolveCursor());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, size]);

  useEffect(() => {
    shapeRef.current = null;
    shapeDragRef.current = null;
    freehandRef.current.active = false;
    eraseRef.current.active = false;
    lineRef.current = null;
    curveRef.current.phase = 'idle';
    snapshotRef.current = null;
    previewRectRef.current = null;
    dirtyRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, [epoch]);

  useImperativeHandle(ref, () => ({
    flush() {
      discardTransient();
      flushDisplay();
    },
    serializeShape() {
      return shapeRef.current ? { ...shapeRef.current } : null;
    },
    getBasePixels() {
      const base = snapshotRef.current;
      if (!shapeRef.current || !base || base.length !== surface.data.length)
        return null;
      return base.slice();
    },
    adopt(shape: Shape) {
      snapshot();
      shapeRef.current = shape;
      shapeDragRef.current = null;
      renderShape();
    },
  }));

  useEffect(() => {
    return () => {
      discardTransient();
      flushDisplay();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Shift' && e.key !== 'Alt') return;
      const drag = shapeDragRef.current;
      const s = shapeRef.current;
      if (!s || !drag || drag.mode !== 'create') return;
      shapeRef.current = {
        ...s,
        ...computeCreate(drag.start, drag.last, e.shiftKey, e.altKey),
      };
      renderShape();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (!shapeRef.current) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      discardShape();
      onStrokeEnd();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStrokeEnd]);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      onWheelZoom(e.clientX, e.clientY, e.deltaY);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheelZoom]);

  function ctx(): CanvasRenderingContext2D | null {
    return paintContext(paintCanvas);
  }

  function setCursor(value: string): void {
    if (divRef.current) divRef.current.style.cursor = value;
  }

  function applyCursor(value: string): void {
    if (value === cursorRef.current) return;
    cursorRef.current = value;
    setCursor(value);
  }

  function resolveCursor(): string {
    if (!BRUSH_TOOLS.includes(tool)) return 'crosshair';
    const scale = viewportRef.current.scaleX || 1;
    return brushCursor(tool === 'eraser' ? ERASER_COLOR : color, size * scale);
  }

  function toImage(e: { clientX: number; clientY: number }): Point {
    const vp = viewportRef.current;
    const rect = divRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - vp.offsetX) / vp.scaleX,
      y: (e.clientY - rect.top - vp.offsetY) / vp.scaleY,
    };
  }

  function snapshotValid(): boolean {
    const s = snapshotRef.current;
    return !!s && s.length === surface.data.length;
  }

  function snapshot(): void {
    snapshotRef.current = surface.data.slice();
    previewRectRef.current = null;
  }

  function padRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): Rect {
    const x = Math.max(0, Math.floor(minX));
    const y = Math.max(0, Math.floor(minY));
    return {
      x,
      y,
      w: Math.max(0, Math.min(surface.width, Math.ceil(maxX)) - x),
      h: Math.max(0, Math.min(surface.height, Math.ceil(maxY)) - y),
    };
  }

  function strokeRect(pts: Point[], size: number): Rect {
    const pad = size / 2 + 3;
    let a = Infinity;
    let b = Infinity;
    let c = -Infinity;
    let d = -Infinity;
    for (const p of pts) {
      if (p.x < a) a = p.x;
      if (p.x > c) c = p.x;
      if (p.y < b) b = p.y;
      if (p.y > d) d = p.y;
    }
    return padRect(a - pad, b - pad, c + pad, d + pad);
  }

  function shapeRect(s: Shape): Rect {
    const bn = bounds(s);
    const chrome = 20 / (viewportRef.current.scaleX || 1) + 4;
    const pad = Math.max(chrome, s.size / 2 + 4);
    return padRect(bn.l - pad, bn.t - pad, bn.r + pad, bn.b + pad);
  }

  function unionRect(x: Rect | null, y: Rect | null): Rect | null {
    if (!x) return y;
    if (!y) return x;
    const px = Math.min(x.x, y.x);
    const py = Math.min(x.y, y.y);
    return {
      x: px,
      y: py,
      w: Math.max(x.x + x.w, y.x + y.w) - px,
      h: Math.max(x.y + x.h, y.y + y.h) - py,
    };
  }

  function flushDisplay(): void {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const d = dirtyRef.current;
    dirtyRef.current = null;
    const c = ctx();
    if (c) {
      if (d === 'full' || !d || d.w <= 0 || d.h <= 0)
        c.putImageData(surface, 0, 0);
      else c.putImageData(surface, 0, 0, d.x, d.y, d.w, d.h);
      const s = shapeRef.current;
      if (s) drawChrome(c, s, viewportRef.current.scaleX || 1);
    }
    onChange();
  }

  function emit(rect?: Rect | null): void {
    if (!rect) dirtyRef.current = 'full';
    else if (dirtyRef.current !== 'full')
      dirtyRef.current = unionRect(dirtyRef.current, rect);
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(flushDisplay);
  }

  function restore(): void {
    if (snapshotValid()) surface.data.set(snapshotRef.current!);
    previewRectRef.current = null;
  }

  function restoreRegion(r: Rect | null): void {
    const snap = snapshotRef.current;
    if (!snap || !snapshotValid() || !r || r.w <= 0 || r.h <= 0) return;
    const rowBytes = r.w * 4;
    for (let y = r.y; y < r.y + r.h; y++) {
      const off = (y * surface.width + r.x) * 4;
      surface.data.set(snap.subarray(off, off + rowBytes), off);
    }
  }

  function preview(next: Rect): void {
    emit(unionRect(previewRectRef.current, next));
    previewRectRef.current = next;
  }

  function renderShape(): void {
    const s = shapeRef.current;
    if (!s || !snapshotValid()) return;
    restoreRegion(previewRectRef.current);
    drawShape(
      surface,
      s.kind,
      s.color,
      s.x,
      s.y,
      s.w,
      s.h,
      s.size,
      s.filled,
      s.dotted,
    );
    preview(shapeRect(s));
  }

  function renderShapeClean(): void {
    const s = shapeRef.current;
    if (!s || !snapshotValid()) return;
    restore();
    drawShape(
      surface,
      s.kind,
      s.color,
      s.x,
      s.y,
      s.w,
      s.h,
      s.size,
      s.filled,
      s.dotted,
    );
    emit();
  }

  function commitShape(): void {
    if (shapeRef.current) renderShapeClean();
    shapeRef.current = null;
    shapeDragRef.current = null;
  }

  function discardTransient(): void {
    if (shapeRef.current) {
      commitShape();
      return;
    }
    if (
      (lineRef.current?.active || curveRef.current.phase !== 'idle') &&
      snapshotValid()
    ) {
      restore();
      emit();
    }
    lineRef.current = null;
    curveRef.current.phase = 'idle';
    snapshotRef.current = null;
  }

  function discardShape(): void {
    restore();
    shapeRef.current = null;
    shapeDragRef.current = null;
    snapshotRef.current = null;
    emit();
  }

  function hitHandle(s: Shape, p: Point): number {
    const hs = 8 / (viewportRef.current.scaleX || 1);
    const pts = handlePoints(s);
    for (let i = 0; i < pts.length; i++)
      if (Math.abs(p.x - pts[i].x) <= hs && Math.abs(p.y - pts[i].y) <= hs)
        return i;
    return -1;
  }

  function inside(s: Shape, p: Point): boolean {
    const { l, t, r, b } = bounds(s);
    return p.x >= l && p.x <= r && p.y >= t && p.y <= b;
  }

  function beginShape(kind: ShapeKind, p: Point) {
    snapshot();
    shapeRef.current = {
      kind,
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      color: colorRef.current,
      size,
      filled,
      dotted,
    };
    shapeDragRef.current = { mode: 'create', start: p, last: p };
  }

  function onShapePointerDown(kind: ShapeKind, p: Point) {
    const s = shapeRef.current;
    if (!s) {
      beginShape(kind, p);
      return;
    }
    const handle = hitHandle(s, p);
    if (handle >= 0) {
      shapeDragRef.current = { mode: 'resize', handle, from: { ...s } };
      return;
    }
    if (inside(s, p)) {
      shapeDragRef.current = { mode: 'move', start: p, from: { ...s } };
      return;
    }
    commitShape();
    beginShape(kind, p);
  }

  function onShapePointerMove(p: Point, shift: boolean, alt: boolean) {
    const drag = shapeDragRef.current;
    const s = shapeRef.current;
    if (!drag || !s) {
      if (s) {
        const h = hitHandle(s, p);
        applyCursor(
          h >= 0 ? HANDLE_CURSOR[h] : inside(s, p) ? 'move' : 'crosshair',
        );
      }
      return;
    }
    if (drag.mode === 'create') {
      drag.last = p;
      shapeRef.current = {
        ...s,
        ...computeCreate(drag.start, p, shift, alt),
      };
    } else if (drag.mode === 'move') {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      shapeRef.current = {
        ...drag.from,
        x: drag.from.x + dx,
        y: drag.from.y + dy,
      };
    } else {
      const f = bounds(drag.from);
      let { l, t, r, b } = f;
      const h = drag.handle;
      if (h === 0 || h === 3 || h === 7) l = p.x;
      if (h === 1 || h === 2 || h === 5) r = p.x;
      if (h === 0 || h === 1 || h === 4) t = p.y;
      if (h === 2 || h === 3 || h === 6) b = p.y;
      shapeRef.current = { ...s, x: l, y: t, w: r - l, h: b - t };
    }
    renderShape();
  }

  function onShapePointerUp() {
    const drag = shapeDragRef.current;
    shapeDragRef.current = null;
    const s = shapeRef.current;
    if (!s || !drag) return;
    if (Math.abs(s.w) < 2 || Math.abs(s.h) < 2) {
      discardShape();
      if (drag.mode !== 'create') onStrokeEnd();
      return;
    }
    renderShapeClean();
    onStrokeEnd();
    renderShape();
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = toImage(e);

    if (e.button === 2) {
      e.preventDefault();
      divRef.current?.setPointerCapture(e.pointerId);
      commitShape();
      lineRef.current = null;
      curveRef.current.phase = 'idle';
      freehandRef.current.active = false;
      snapshotRef.current = null;
      eraseRef.current = { active: true, points: [p] };
      emit(drawFreehand(surface, 'eraser', color, size, [p]));
      return;
    }

    if (e.button !== 0) return;
    divRef.current?.setPointerCapture(e.pointerId);

    if (tool === 'sampler') {
      samplingRef.current = true;
      const hex = sampleColor(surface, p.x, p.y);
      if (hex) onPickColor(hex);
      return;
    }

    if (tool === 'rect' || tool === 'ellipse') {
      onShapePointerDown(tool, p);
      return;
    }

    if (tool === 'fill') {
      floodFill(surface, p.x, p.y, color);
      emit();
      onStrokeEnd();
      return;
    }

    if (tool === 'pencil' || tool === 'eraser') {
      freehandRef.current = { active: true, points: [p] };
      dotCarryRef.current = 0;
      emit(drawFreehand(surface, tool, color, size, [p], dotted));
      return;
    }

    if (tool === 'line') {
      snapshot();
      lineRef.current = { active: true, a: p };
      return;
    }

    const curve = curveRef.current;
    if (curve.phase === 'awaitControl') {
      curve.phase = 'control';
      restoreRegion(previewRectRef.current);
      drawCurve(surface, color, size, curve.a, curve.b, p, dotted);
      preview(strokeRect([curve.a, curve.b, p], size));
      return;
    }
    snapshot();
    curveRef.current = { phase: 'idle', a: p, b: p };
    lineRef.current = { active: true, a: p };
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toImage(e);

    if (tool !== 'rect' && tool !== 'ellipse') applyCursor(resolveCursor());

    if (tool === 'sampler') {
      if (samplingRef.current) {
        const hex = sampleColor(surface, p.x, p.y);
        if (hex) onPickColor(hex);
      }
      return;
    }

    if (eraseRef.current.active) {
      const pts = eraseRef.current.points;
      pts.push(p);
      emit(drawFreehand(surface, 'eraser', color, size, pts.slice(-2)));
      return;
    }

    if (tool === 'rect' || tool === 'ellipse') {
      onShapePointerMove(p, e.shiftKey, e.altKey);
      return;
    }

    if (
      (tool === 'pencil' || tool === 'eraser') &&
      freehandRef.current.active
    ) {
      const pts = freehandRef.current.points;
      const prev = pts[pts.length - 1];
      pts.push(p);
      if (dotted && tool === 'pencil') {
        const { carry, rect } = drawFreehandDot(
          surface,
          color,
          size,
          prev,
          p,
          dotCarryRef.current,
        );
        dotCarryRef.current = carry;
        emit(rect);
      } else {
        emit(drawFreehand(surface, tool, color, size, pts.slice(-2), false));
      }
      return;
    }

    if (tool === 'line' && lineRef.current?.active) {
      restoreRegion(previewRectRef.current);
      drawLine(surface, color, size, lineRef.current.a, p, dotted);
      preview(strokeRect([lineRef.current.a, p], size));
      return;
    }

    if (tool === 'curve') {
      const curve = curveRef.current;
      if (lineRef.current?.active) {
        restoreRegion(previewRectRef.current);
        drawLine(surface, color, size, lineRef.current.a, p, dotted);
        preview(strokeRect([lineRef.current.a, p], size));
      } else if (curve.phase === 'control') {
        restoreRegion(previewRectRef.current);
        drawCurve(surface, color, size, curve.a, curve.b, p, dotted);
        preview(strokeRect([curve.a, curve.b, p], size));
      }
    }
  }

  function onPointerCancel(): void {
    discardTransient();
    curveRef.current.phase = 'idle';
    lineRef.current = null;
    freehandRef.current.active = false;
    eraseRef.current.active = false;
    samplingRef.current = false;
    shapeDragRef.current = null;
    snapshotRef.current = null;
    flushDisplay();
  }

  function onPointerUp(e: React.PointerEvent) {
    divRef.current?.releasePointerCapture(e.pointerId);
    const p = toImage(e);

    if (tool === 'sampler') {
      samplingRef.current = false;
      return;
    }

    if (eraseRef.current.active) {
      eraseRef.current.active = false;
      onStrokeEnd();
      return;
    }

    if (tool === 'rect' || tool === 'ellipse') {
      onShapePointerUp();
      return;
    }

    if (tool === 'pencil' || tool === 'eraser') {
      if (freehandRef.current.active) {
        freehandRef.current.active = false;
        onStrokeEnd();
      }
      return;
    }

    if (tool === 'line' && lineRef.current?.active) {
      restoreRegion(previewRectRef.current);
      drawLine(surface, color, size, lineRef.current.a, p, dotted);
      emit(strokeRect([lineRef.current.a, p], size));
      lineRef.current = null;
      snapshotRef.current = null;
      previewRectRef.current = null;
      onStrokeEnd();
      return;
    }

    if (tool === 'curve') {
      const curve = curveRef.current;
      if (lineRef.current?.active) {
        lineRef.current = null;
        curve.b = p;
        curve.phase = 'awaitControl';
        restoreRegion(previewRectRef.current);
        drawLine(surface, color, size, curve.a, p, dotted);
        preview(strokeRect([curve.a, p], size));
      } else if (curve.phase === 'control') {
        restoreRegion(previewRectRef.current);
        drawCurve(surface, color, size, curve.a, curve.b, p, dotted);
        emit(strokeRect([curve.a, curve.b, p], size));
        curve.phase = 'idle';
        snapshotRef.current = null;
        previewRectRef.current = null;
        onStrokeEnd();
      }
    }
  }

  return (
    <div
      ref={divRef}
      className="position-fixed top-0 bottom-0 start-0 end-0 z-1"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
});

export default PaintLayer;
