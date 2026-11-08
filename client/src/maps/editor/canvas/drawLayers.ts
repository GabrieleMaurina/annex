import type { Viewport } from './canvasGeometry';
import { drawSmoothPaint } from './smoothEdges';

export interface PaintLayers {
  tiles: HTMLCanvasElement | null;
  overlays: (HTMLCanvasElement | null)[];
}

interface PaintSource {
  canvas: HTMLCanvasElement;
  version: number | undefined;
  hidden: boolean | undefined;
  smooth: boolean;
}

export function drawPaintLayers(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  layers: PaintLayers,
  paint: PaintSource,
) {
  const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = viewport;
  ctx.imageSmoothingEnabled = false;
  const drawLayer = (layer: HTMLCanvasElement) =>
    ctx.drawImage(layer, offsetX, offsetY, imgW * scaleX, imgH * scaleY);
  const smoothed =
    !paint.hidden &&
    paint.smooth &&
    drawSmoothPaint(
      ctx,
      paint.canvas,
      paint.version,
      layers.tiles,
      offsetX,
      offsetY,
      scaleX,
    );
  if (!paint.hidden && !smoothed) drawLayer(paint.canvas);
  if (layers.tiles && !smoothed) drawLayer(layers.tiles);
  for (const overlay of layers.overlays) if (overlay) drawLayer(overlay);
}
