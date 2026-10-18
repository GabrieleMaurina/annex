import type { ClickableRegions } from '../../regions/clickableRegions';
import type { RegionShape } from '../../regions/traceRegions';

export interface ImageView {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

function enterImageSpace(ctx: CanvasRenderingContext2D, view: ImageView) {
  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scaleX, view.scaleY);
}

interface FillLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  colors: Map<number, string>;
}

const fillLayers = new WeakMap<ClickableRegions, FillLayer>();

export function regionFillLayer(
  regions: ClickableRegions,
  colors: Map<number, string>,
): HTMLCanvasElement {
  let layer = fillLayers.get(regions);
  if (!layer) {
    const canvas = document.createElement('canvas');
    canvas.width = regions.width;
    canvas.height = regions.height;
    layer = { canvas, ctx: canvas.getContext('2d')!, colors: new Map() };
    fillLayers.set(regions, layer);
  }
  const { ctx } = layer;
  ctx.globalCompositeOperation = 'destination-out';
  for (const id of layer.colors.keys())
    if (!colors.has(id)) ctx.fill(regions.shapes.get(id)!.fill);
  ctx.globalCompositeOperation = 'source-over';
  for (const [id, color] of colors) {
    if (layer.colors.get(id) === color) continue;
    ctx.fillStyle = color;
    ctx.fill(regions.shapes.get(id)!.fill);
  }
  layer.colors = colors;
  return layer.canvas;
}

export function outlineContinentRegion(
  ctx: CanvasRenderingContext2D,
  shape: RegionShape,
  view: ImageView,
  tinted: boolean,
) {
  const width = ctx.lineWidth;
  const dash = ctx.getLineDash();
  enterImageSpace(ctx, view);
  ctx.lineWidth = width / view.scaleX;
  ctx.setLineDash(dash.map((d) => d / view.scaleX));
  if (tinted) ctx.fill(shape.outline);
  ctx.stroke(shape.outline);
  ctx.restore();
}

export function strokeRegion(
  ctx: CanvasRenderingContext2D,
  shape: RegionShape,
  color: string,
  width: number,
  view: ImageView,
) {
  enterImageSpace(ctx, view);
  ctx.clip(shape.outline);
  ctx.strokeStyle = color;
  ctx.lineWidth = (width * 2) / view.scaleX;
  ctx.lineJoin = 'round';
  ctx.stroke(shape.outline);
  ctx.restore();
}
