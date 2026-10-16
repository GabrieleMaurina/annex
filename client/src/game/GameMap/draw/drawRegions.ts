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

export function fillRegion(
  ctx: CanvasRenderingContext2D,
  shape: RegionShape,
  color: string,
  view: ImageView,
) {
  enterImageSpace(ctx, view);
  ctx.fillStyle = color;
  ctx.fill(shape.fill);
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
