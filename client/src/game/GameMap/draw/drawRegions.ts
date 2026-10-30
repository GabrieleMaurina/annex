import { TILE_SEAM_COLOR, TILE_WALL_COLOR } from 'engine';
import type { ClickableRegions } from '../../regions/clickableRegions';
import type { RegionShape } from '../../regions/traceRegions';
import { polygonPath, tileEdges } from '../../tiles/tileGeometry';
import { tileAt } from '../../tiles/unlock';

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

const UNLOCKED_TILE_COLOR = '#4a4f58';
const tileLayers = new WeakMap<
  ClickableRegions,
  { key: string; canvas: HTMLCanvasElement }
>();

export function unlockedTileLayer(
  regions: ClickableRegions,
  hiddenIds: Set<number>,
): HTMLCanvasElement | null {
  if (!regions.unlocked) return null;
  const key = [...hiddenIds].sort((a, b) => a - b).join(',');
  const cached = tileLayers.get(regions);
  if (cached?.key === key) return cached.canvas;
  const tiles = regions.unlocked.tiles.filter(
    (tile) => !hiddenIds.has(tile.id),
  );
  const { lineWidth } = regions.unlocked;
  const canvas = document.createElement('canvas');
  canvas.width = regions.width;
  canvas.height = regions.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = UNLOCKED_TILE_COLOR;
  for (const tile of tiles) ctx.fill(polygonPath(tile.points));
  const seams = new Path2D();
  const walls = new Path2D();
  for (const tile of tiles) {
    for (const { from, to, outside } of tileEdges(tile, lineWidth)) {
      const path = tileAt(tiles, ...outside) ? seams : walls;
      path.moveTo(...from);
      path.lineTo(...to);
    }
  }
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.strokeStyle = TILE_SEAM_COLOR;
  ctx.stroke(seams);
  ctx.strokeStyle = TILE_WALL_COLOR;
  ctx.stroke(walls);
  tileLayers.set(regions, { key, canvas });
  return canvas;
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
