export interface LayerView {
  dpr: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  uiScale: number;
}

export type LayerReuse = 'transform' | 'translate';

export interface LayerRequest {
  name: string;
  content: string | null;
  view: LayerView;
  reuse: LayerReuse;
}

interface Layer {
  canvas: HTMLCanvasElement;
  content: string | null;
  view: LayerView | null;
  marginX: number;
  marginY: number;
  seenView: LayerView | null;
  seenAt: number;
}

const MARGIN = 0.125;
const MAX_MARGIN = 384;
const STABLE_MS = 100;
const SETTLE_SLACK_MS = 50;

const layersByCanvas = new WeakMap<HTMLCanvasElement, Map<string, Layer>>();
const identities = new WeakMap<object, number>();
let lastIdentity = 0;
let settleUntil = 0;

export function identityOf(value: object | null): number {
  if (value === null) return 0;
  let id = identities.get(value);
  if (id === undefined) {
    lastIdentity += 1;
    id = lastIdentity;
    identities.set(value, id);
  }
  return id;
}

export function layersSettling(): boolean {
  return performance.now() < settleUntil;
}

export function resetCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  } else {
    ctx.reset();
  }
}

function sameView(a: LayerView, b: LayerView): boolean {
  return (
    a.dpr === b.dpr &&
    a.width === b.width &&
    a.height === b.height &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY &&
    a.uiScale === b.uiScale
  );
}

function reusable(layer: Layer, view: LayerView, reuse: LayerReuse): boolean {
  const from = layer.view!;
  if (from.dpr !== view.dpr) return false;
  if (reuse === 'transform') return true;
  return (
    from.width === view.width &&
    from.height === view.height &&
    from.scaleX === view.scaleX &&
    from.scaleY === view.scaleY &&
    from.uiScale === view.uiScale &&
    Math.abs((view.offsetX - from.offsetX) * view.dpr) <= layer.marginX &&
    Math.abs((view.offsetY - from.offsetY) * view.dpr) <= layer.marginY
  );
}

function layerOf(target: HTMLCanvasElement, name: string): Layer {
  let layers = layersByCanvas.get(target);
  if (!layers) {
    layers = new Map();
    layersByCanvas.set(target, layers);
  }
  let layer = layers.get(name);
  if (!layer) {
    layer = {
      canvas: document.createElement('canvas'),
      content: null,
      view: null,
      marginX: 0,
      marginY: 0,
      seenView: null,
      seenAt: 0,
    };
    layers.set(name, layer);
  }
  return layer;
}

function rebuild(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  content: string,
  view: LayerView,
  paint: (target: CanvasRenderingContext2D) => void,
) {
  layer.marginX = Math.min(Math.round(view.width * MARGIN), MAX_MARGIN);
  layer.marginY = Math.min(Math.round(view.height * MARGIN), MAX_MARGIN);
  const target = layer.canvas.getContext('2d')!;
  resetCanvas(
    layer.canvas,
    target,
    view.width + 2 * layer.marginX,
    view.height + 2 * layer.marginY,
  );
  target.setTransform(
    new DOMMatrix()
      .translate(layer.marginX, layer.marginY)
      .multiply(ctx.getTransform()),
  );
  paint(target);
  layer.content = content;
  layer.view = view;
}

function blit(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  from: LayerView,
  to: LayerView,
) {
  const rx = to.scaleX / from.scaleX;
  const ry = to.scaleY / from.scaleY;
  let tx = (to.offsetX - rx * from.offsetX) * to.dpr - rx * layer.marginX;
  let ty = (to.offsetY - ry * from.offsetY) * to.dpr - ry * layer.marginY;
  if (rx === 1 && ry === 1) {
    tx = Math.round(tx);
    ty = Math.round(ty);
  }
  ctx.save();
  ctx.setTransform(rx, 0, 0, ry, tx, ty);
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

export function drawCached(
  ctx: CanvasRenderingContext2D,
  { name, content, view, reuse }: LayerRequest,
  paint: (target: CanvasRenderingContext2D) => void,
) {
  if (content === null) {
    paint(ctx);
    return;
  }
  const layer = layerOf(ctx.canvas, name);
  const now = performance.now();
  const steady = layer.seenView !== null && sameView(layer.seenView, view);
  if (!steady) {
    layer.seenView = view;
    layer.seenAt = now;
  }
  if (layer.content === content && layer.view) {
    if (sameView(layer.view, view)) {
      blit(ctx, layer, view, view);
      return;
    }
    if (
      reusable(layer, view, reuse) &&
      !(steady && now - layer.seenAt >= STABLE_MS)
    ) {
      settleUntil = now + STABLE_MS + SETTLE_SLACK_MS;
      blit(ctx, layer, layer.view, view);
      return;
    }
  }
  if (!steady && layer.content === content) {
    paint(ctx);
    return;
  }
  rebuild(ctx, layer, content, view, paint);
  blit(ctx, layer, view, view);
}
