import type { MutableRefObject } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { playSound } from '../../../lib/sounds';
import { CURSOR_GRAB, CURSOR_GRABBING } from '../../../ui/cursors/cursors';
import {
  drawCurve,
  drawFreehand,
  drawFreehandDot,
  drawLine,
  ERASER_COLOR,
  floodFill,
  paintContext,
  sampleColor,
  type PaintTool,
  type Point,
  type Rect,
} from './paintTools';
import {
  computeCreate,
  drawChrome,
  drawHandle,
  drawShape,
  handleCursor,
  hitHandle,
  insideShape,
  nearHandle,
  resizeShape,
  ROTATE_HANDLE,
  rotateShape,
  rotationDegrees,
  shapeAspect,
  shapeExtent,
  type Shape,
  type ShapeDrag,
  type ShapeKind,
} from './shapes';

export interface Viewport {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export interface PaintLayerHandle {
  flush: () => void;
  serializeShape: () => Shape | null;
  getBasePixels: () => Uint8ClampedArray | null;
  adopt: (shape: Shape) => void;
  refreshCursor: () => void;
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
  shapeKind: ShapeKind | null;
  epoch: number;
  onStrokeEnd: () => void;
  onChange: () => void;
  onWheelZoom: (clientX: number, clientY: number, deltaY: number) => void;
  onPickColor: (hex: string) => void;
  onPanStart: (clientX: number, clientY: number) => void;
  onPanMove: (clientX: number, clientY: number) => void;
  onPanEnd: () => void;
}

const BRUSH_TOOLS: PaintTool[] = ['pencil', 'line', 'curve', 'eraser'];
const MAX_CURSOR_DIAMETER = 128;

function brushCursor(color: string, diameter: number): string {
  const d = Math.round(diameter);
  if (d < 7) return 'crosshair';
  if (diameter > MAX_CURSOR_DIAMETER) return 'none';
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
    shapeKind,
    epoch,
    onStrokeEnd,
    onChange,
    onWheelZoom,
    onPickColor,
    onPanStart,
    onPanMove,
    onPanEnd,
  },
  ref,
) {
  const surface = surfaceRef.current;
  const forcePanRef = useRef(false);
  const pausedActionRef = useRef(false);
  const ctrlHeldRef = useRef(false);
  const divRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef<Point | null>(null);
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
    handle: Point;
  }>({
    phase: 'idle',
    a: { x: 0, y: 0 },
    b: { x: 0, y: 0 },
    handle: { x: 0, y: 0 },
  });
  const eraseRef = useRef<{ active: boolean; points: Point[] }>({
    active: false,
    points: [],
  });
  const shapeRef = useRef<Shape | null>(null);
  const shapeDragRef = useRef<ShapeDrag | null>(null);
  const colorRef = useRef(color);
  const cursorRef = useRef('');
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
      const kindChanged = !!shapeKind && shapeKind !== shapeRef.current.kind;
      shapeRef.current = {
        ...shapeRef.current,
        kind: shapeKind ?? shapeRef.current.kind,
        size,
        filled,
        dotted,
      };
      renderShape();
      if (kindChanged) onStrokeEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKind, size, filled, dotted]);

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
    updateOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  useEffect(() => {
    applyCursor(resolveCursor());
    updateOverlay();
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
    refreshCursor() {
      applyCursor(resolveCursor());
      updateOverlay();
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
        ...computeCreate(
          drag.start,
          drag.last,
          e.shiftKey,
          e.altKey,
          shapeAspect(s.kind),
        ),
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
  }, [surface]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey === ctrlHeldRef.current || forcePanRef.current) return;
      ctrlHeldRef.current = e.ctrlKey;
      applyCursor(resolveCursor());
      updateOverlay();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, color, size]);

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
      playSound('click');
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
    if (ctrlHeldRef.current) return CURSOR_GRAB;
    if (onCurveHandle()) return 'move';
    if (!BRUSH_TOOLS.includes(tool)) return 'crosshair';
    const scale = viewportRef.current.scaleX || 1;
    return brushCursor(tool === 'eraser' ? ERASER_COLOR : color, size * scale);
  }

  function onCurveHandle(): boolean {
    const curve = curveRef.current;
    const p = lastPointerRef.current;
    if (tool !== 'curve' || curve.phase === 'idle' || !p) return false;
    if (curve.phase === 'control') return true;
    const q = toImage({ clientX: p.x, clientY: p.y });
    return nearHandle(q, curve.handle, viewportRef.current.scaleX || 1);
  }

  function updateOverlay(): void {
    const el = overlayRef.current;
    if (!el) return;
    const p = lastPointerRef.current;
    const scale = viewportRef.current.scaleX || 1;
    const diameter = size * scale;
    if (
      !p ||
      ctrlHeldRef.current ||
      cursorRef.current === 'move' ||
      !BRUSH_TOOLS.includes(tool) ||
      diameter <= MAX_CURSOR_DIAMETER
    ) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.width = `${diameter}px`;
    el.style.height = `${diameter}px`;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.backgroundColor = tool === 'eraser' ? ERASER_COLOR : color;
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

  function curveRect(pts: Point[]): Rect {
    return strokeRect(
      pts,
      Math.max(size, 12 / (viewportRef.current.scaleX || 1)),
    );
  }

  function bendCurve(p: Point): Rect {
    const curve = curveRef.current;
    curve.handle = p;
    const control = {
      x: 2 * p.x - (curve.a.x + curve.b.x) / 2,
      y: 2 * p.y - (curve.a.y + curve.b.y) / 2,
    };
    restoreRegion(previewRectRef.current);
    drawCurve(surface, color, size, curve.a, curve.b, control, dotted);
    return curveRect([curve.a, curve.b, control]);
  }

  function shapeRect(s: Shape): Rect {
    const scale = viewportRef.current.scaleX || 1;
    const bn = shapeExtent(s, scale);
    const pad = Math.max(20 / scale + 4, s.size / 2 + 4);
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
      const scale = viewportRef.current.scaleX || 1;
      const s = shapeRef.current;
      if (s) drawChrome(c, s, scale);
      const curve = curveRef.current;
      if (curve.phase !== 'idle') drawHandle(c, curve.handle, scale);
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
    drawShape(surface, s);
    preview(shapeRect(s));
  }

  function renderShapeClean(): void {
    const s = shapeRef.current;
    if (!s || !snapshotValid()) return;
    restore();
    drawShape(surface, s);
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

  function beginShape(kind: ShapeKind, p: Point) {
    snapshot();
    shapeRef.current = {
      kind,
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      rotation: 0,
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
    const handle = hitHandle(s, p, viewportRef.current.scaleX || 1);
    if (handle === ROTATE_HANDLE) {
      shapeDragRef.current = { mode: 'rotate', start: p, from: { ...s } };
      return;
    }
    if (handle >= 0) {
      shapeDragRef.current = { mode: 'resize', handle, from: { ...s } };
      return;
    }
    if (insideShape(s, p)) {
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
      if (s && !ctrlHeldRef.current) {
        const h = hitHandle(s, p, viewportRef.current.scaleX || 1);
        applyCursor(
          h >= 0
            ? handleCursor(s, h)
            : insideShape(s, p)
              ? 'move'
              : 'crosshair',
        );
      }
      return;
    }
    if (drag.mode === 'create') {
      drag.last = p;
      shapeRef.current = {
        ...s,
        ...computeCreate(drag.start, p, shift, alt, shapeAspect(s.kind)),
      };
    } else if (drag.mode === 'move') {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      shapeRef.current = {
        ...drag.from,
        x: drag.from.x + dx,
        y: drag.from.y + dy,
      };
    } else if (drag.mode === 'resize') {
      shapeRef.current = resizeShape(drag.from, drag.handle, p);
    } else {
      shapeRef.current = rotateShape(drag.from, drag.start, p);
      showAngle(shapeRef.current);
    }
    renderShape();
  }

  function showAngle(s: Shape): void {
    const el = angleRef.current;
    const p = lastPointerRef.current;
    if (!el || !p) return;
    el.style.display = 'block';
    el.style.left = `${p.x + 16}px`;
    el.style.top = `${p.y + 16}px`;
    el.textContent = `${rotationDegrees(s)}°`;
  }

  function hideAngle(): void {
    if (angleRef.current) angleRef.current.style.display = 'none';
  }

  function onShapePointerUp() {
    hideAngle();
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

  function startForcePan(e: React.PointerEvent) {
    forcePanRef.current = true;
    if (overlayRef.current) overlayRef.current.style.display = 'none';
    applyCursor(CURSOR_GRABBING);
    onPanStart(e.clientX, e.clientY);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button === 0 && e.ctrlKey) {
      e.preventDefault();
      divRef.current?.setPointerCapture(e.pointerId);
      startForcePan(e);
      return;
    }

    const p = toImage(e);

    if (e.button === 2) {
      e.preventDefault();
      divRef.current?.setPointerCapture(e.pointerId);
      discardTransient();
      freehandRef.current.active = false;
      snapshotRef.current = null;
      eraseRef.current = { active: true, points: [p] };
      emit(drawFreehand(surface, 'eraser', color, size, [p]));
      return;
    }

    if (e.button !== 0) return;
    divRef.current?.setPointerCapture(e.pointerId);

    if (tool === 'sampler') {
      playSound('click');
      samplingRef.current = true;
      const hex = sampleColor(surface, p.x, p.y);
      if (hex) onPickColor(hex);
      return;
    }

    if (tool === 'shape') {
      if (shapeKind) onShapePointerDown(shapeKind, p);
      return;
    }

    if (tool === 'fill') {
      playSound('click');
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
      preview(bendCurve(p));
      return;
    }
    snapshot();
    curveRef.current = { phase: 'idle', a: p, b: p, handle: p };
    lineRef.current = { active: true, a: p };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!forcePanRef.current && e.ctrlKey && e.buttons & 1) {
      pausedActionRef.current = true;
      startForcePan(e);
    } else if (pausedActionRef.current && !e.ctrlKey) {
      pausedActionRef.current = false;
      forcePanRef.current = false;
      onPanEnd();
      freehandRef.current.points.push(toImage(e));
    }

    if (forcePanRef.current) {
      onPanMove(e.clientX, e.clientY);
      return;
    }

    const p = toImage(e);

    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    const ctrlChanged = e.ctrlKey !== ctrlHeldRef.current;
    ctrlHeldRef.current = e.ctrlKey;
    if (ctrlChanged || tool !== 'shape') {
      applyCursor(resolveCursor());
      updateOverlay();
    } else {
      overlayRef.current!.style.display = 'none';
    }

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

    if (tool === 'shape') {
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
        preview(bendCurve(p));
      }
    }
  }

  function onPointerCancel(): void {
    pausedActionRef.current = false;
    if (forcePanRef.current) {
      forcePanRef.current = false;
      onPanEnd();
    }
    discardTransient();
    curveRef.current.phase = 'idle';
    lineRef.current = null;
    freehandRef.current.active = false;
    eraseRef.current.active = false;
    samplingRef.current = false;
    shapeDragRef.current = null;
    snapshotRef.current = null;
    flushDisplay();
    lastPointerRef.current = null;
    if (overlayRef.current) overlayRef.current.style.display = 'none';
    hideAngle();
  }

  function onPointerLeave(): void {
    lastPointerRef.current = null;
    if (overlayRef.current) overlayRef.current.style.display = 'none';
  }

  function onPointerUp(e: React.PointerEvent) {
    divRef.current?.releasePointerCapture(e.pointerId);

    if (forcePanRef.current) {
      forcePanRef.current = false;
      ctrlHeldRef.current = e.ctrlKey;
      onPanEnd();
      applyCursor(resolveCursor());
      if (!pausedActionRef.current) return;
      pausedActionRef.current = false;
    }

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

    if (tool === 'shape') {
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
        curve.handle = { x: (curve.a.x + p.x) / 2, y: (curve.a.y + p.y) / 2 };
        restoreRegion(previewRectRef.current);
        drawLine(surface, color, size, curve.a, p, dotted);
        preview(curveRect([curve.a, p]));
      } else if (curve.phase === 'control') {
        emit(unionRect(previewRectRef.current, bendCurve(p)));
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
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={overlayRef}
        className="position-fixed rounded-circle translate-middle pe-none"
        style={{ display: 'none', boxShadow: '0 0 0 1px #000, 0 0 0 2px #fff' }}
      />
      <div
        ref={angleRef}
        className="position-fixed badge bg-dark pe-none"
        style={{ display: 'none' }}
      />
    </div>
  );
});

export default PaintLayer;
