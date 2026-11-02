import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { playSound } from '../../../lib/sounds';
import type { PaintTool, Point } from './paintTools';
import {
  CHROME_COLOR,
  drawShape,
  shapeBounds,
  type SelectionImage,
  type Shape,
} from './shapes';

let copiedShape: Shape | null = null;

export function isSelectTool(tool: PaintTool): boolean {
  return tool === 'select' || tool === 'lasso';
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.isContentEditable)
  );
}

export function rectOutline(a: Point, b: Point): Point[] {
  const x0 = Math.round(a.x);
  const y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export function drawOutline(
  c: CanvasRenderingContext2D,
  outline: Point[],
  scale: number,
): void {
  c.save();
  c.strokeStyle = CHROME_COLOR;
  c.lineWidth = 1 / scale;
  c.setLineDash([4 / scale, 3 / scale]);
  c.beginPath();
  outline.forEach((p) => c.lineTo(p.x, p.y));
  c.closePath();
  c.stroke();
  c.restore();
}

const floatingCanvases = new WeakMap<SelectionImage, HTMLCanvasElement>();

function floatingCanvas(image: SelectionImage): HTMLCanvasElement {
  let canvas = floatingCanvases.get(image);
  if (canvas) return canvas;
  const { pixels, mask } = image;
  const visible = new ImageData(pixels.width, pixels.height);
  const from = new Uint32Array(pixels.data.buffer);
  const to = new Uint32Array(visible.data.buffer);
  for (let i = 0; i < mask.length; i++) if (mask[i]) to[i] = from[i];
  canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  canvas.getContext('2d')!.putImageData(visible, 0, 0);
  floatingCanvases.set(image, canvas);
  return canvas;
}

export function drawFloating(c: CanvasRenderingContext2D, s: Shape): void {
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(s.x + s.w / 2, s.y + s.h / 2);
  c.rotate(s.rotation);
  c.scale(Math.sign(s.w), Math.sign(s.h));
  c.drawImage(floatingCanvas(s.image!), -w / 2, -h / 2, w, h);
  c.restore();
}

export function liftSelection(
  surface: ImageData,
  base: Uint8ClampedArray,
  outline: Point[],
): Shape | null {
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const w = Math.min(surface.width, Math.ceil(Math.max(...xs))) - left;
  const h = Math.min(surface.height, Math.ceil(Math.max(...ys))) - top;
  if (w < 2 || h < 2) return null;
  const pixels = new ImageData(w, h);
  const mask = new Uint8Array(w * h);
  const source = new Uint32Array(surface.data.buffer);
  const lifted = new Uint32Array(pixels.data.buffer);
  const whitened = new Uint32Array(base.buffer);
  for (let y = 0; y < h; y++) {
    const yy = top + y + 0.5;
    const cuts: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i];
      const q = outline[(i + 1) % outline.length];
      if (p.y <= yy === q.y <= yy) continue;
      cuts.push(p.x + ((yy - p.y) / (q.y - p.y)) * (q.x - p.x));
    }
    cuts.sort((m, n) => m - n);
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const from = Math.max(left, Math.round(cuts[i]));
      const to = Math.min(left + w, Math.round(cuts[i + 1]));
      for (let x = from; x < to; x++) {
        const src = (top + y) * surface.width + x;
        const dst = y * w + x - left;
        mask[dst] = 1;
        lifted[dst] = source[src];
        whitened[src] = 0xffffffff;
      }
    }
  }
  return mask.includes(1) ? imageShape(pixels, mask, left, top) : null;
}

function imageShape(
  pixels: ImageData,
  mask: Uint8Array,
  x: number,
  y: number,
): Shape {
  return {
    kind: 'square',
    x,
    y,
    w: pixels.width,
    h: pixels.height,
    rotation: 0,
    color: '#ffffff',
    size: 1,
    filled: false,
    dotted: false,
    image: { pixels, mask },
  };
}

function copyImage(shape: Shape): void {
  const e = shapeBounds(shape);
  const left = Math.floor(e.l);
  const top = Math.floor(e.t);
  const image = new ImageData(Math.ceil(e.r) - left, Math.ceil(e.b) - top);
  drawShape(image, { ...shape, x: shape.x - left, y: shape.y - top });
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  const png = new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), 'image/png'),
  );
  navigator.clipboard
    ?.write([new ClipboardItem({ 'image/png': png })])
    .catch(() => undefined);
}

function pastedShape(bitmap: ImageBitmap, center: Point): Shape {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(pixels.width * pixels.height);
  for (let i = 0; i < mask.length; i++)
    if (pixels.data[i * 4 + 3] > 0) mask[i] = 1;
  return imageShape(
    pixels,
    mask,
    Math.round(center.x - pixels.width / 2),
    Math.round(center.y - pixels.height / 2),
  );
}

interface ClipboardArgs {
  tool: PaintTool;
  shapeRef: MutableRefObject<Shape | null>;
  busy: () => boolean;
  pastePoint: () => Point;
  stamp: (next: Shape) => void;
  discard: () => void;
  onToolChange: (tool: PaintTool) => void;
}

export function useFloatingShapeKeys(args: ClipboardArgs): void {
  const argsRef = useRef(args);
  const pendingRef = useRef<Shape | null>(null);
  useEffect(() => {
    argsRef.current = args;
  });

  useEffect(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) argsRef.current.stamp(pending);
  }, [args.tool]);

  useEffect(() => {
    let alive = true;
    function place(next: Shape) {
      const { tool, stamp, onToolChange } = argsRef.current;
      playSound('click');
      if (!next.image || isSelectTool(tool)) {
        stamp(next);
        return;
      }
      pendingRef.current = next;
      onToolChange('select');
    }
    function onKey(e: KeyboardEvent) {
      const { shapeRef, busy, stamp, discard } = argsRef.current;
      const shape = shapeRef.current;
      if (!shape || isTypingTarget(e.target)) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        playSound('click');
        discard();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'c') return;
      if (e.repeat || busy()) return;
      e.preventDefault();
      playSound('click');
      copiedShape = shape.image ? null : { ...shape };
      if (shape.image) copyImage(shape);
      stamp({ ...shape });
    }
    function onPaste(e: ClipboardEvent) {
      const { tool, busy, pastePoint } = argsRef.current;
      if (busy() || isTypingTarget(e.target)) return;
      const center = pastePoint();
      if (copiedShape && tool === 'shape') {
        e.preventDefault();
        const { w, h } = copiedShape;
        place({ ...copiedShape, x: center.x - w / 2, y: center.y - h / 2 });
        return;
      }
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith('image/'),
      );
      if (!file) return;
      e.preventDefault();
      createImageBitmap(file, {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none',
      }).then(
        (bitmap) => {
          if (alive) place(pastedShape(bitmap, center));
        },
        () => undefined,
      );
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      alive = false;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, []);
}
