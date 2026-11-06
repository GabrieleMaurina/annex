import { polygonPath, tileLineWidth } from '../../../game/tiles/tileGeometry';
import { drawPolygon, ERASER_COLOR, sampleColor } from '../paint/paintTools';
import { tileCenter, type EditorTile } from './editorTiles';

export interface TileDecor {
  ghosts: EditorTile[];
}

const LOCKED_FILL = '#d9d9d9';
const SELECTED_COLOR = '#0d6efd';
const GHOST_ALPHA = 0.5;
const ERASE_MARGIN = 2;
const FOOTPRINT_COLOR = '#000000';

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: EditorTile,
  lineWidth: number,
  borderColor: string,
) {
  const path = polygonPath(tile.points);
  ctx.fillStyle = tile.unlockable ? LOCKED_FILL : tile.color;
  ctx.fill(path);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke(path);
}

export function drawTileOverlay(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  tiles: EditorTile[],
  selected: number | null,
  decor: TileDecor | null,
  borderColor: string,
) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  const ghosts = decor?.ghosts ?? [];
  const lineWidth = tileLineWidth([...tiles, ...ghosts]);
  ctx.lineJoin = 'round';
  for (const tile of tiles.filter((t) => !t.unlockable))
    drawTile(ctx, tile, lineWidth, borderColor);
  for (const tile of tiles.filter((t) => t.unlockable))
    drawTile(ctx, tile, lineWidth, borderColor);
  if (selected !== null && tiles[selected]) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = SELECTED_COLOR;
    ctx.stroke(polygonPath(tiles[selected].points));
  }
  ctx.globalAlpha = GHOST_ALPHA;
  for (const ghost of ghosts) drawTile(ctx, ghost, lineWidth, borderColor);
  ctx.globalAlpha = 1;
}

function outline(tile: EditorTile) {
  return tile.points.map(([x, y]) => ({ x, y }));
}

function copyOf(surface: ImageData): ImageData {
  return new ImageData(surface.data.slice(), surface.width, surface.height);
}

function fillTiles(
  surface: ImageData,
  tiles: EditorTile[],
  color: (tile: EditorTile) => string,
  borderColor: string,
  lineWidth: number,
) {
  for (const tile of tiles)
    drawPolygon(surface, color(tile), outline(tile), 0, true, false);
  for (const tile of tiles)
    drawPolygon(surface, borderColor, outline(tile), lineWidth, false, false);
}

export function bakeTiles(
  surface: ImageData,
  tiles: EditorTile[],
  borderColor: string,
): ImageData {
  const baked = copyOf(surface);
  fillTiles(
    baked,
    tiles.filter((t) => !t.unlockable),
    (tile) => tile.color,
    borderColor,
    tileLineWidth(tiles),
  );
  return baked;
}

export function eraseTiles(surface: ImageData, tiles: EditorTile[]) {
  const lineWidth = tileLineWidth(tiles) + ERASE_MARGIN;
  for (const tile of tiles.filter((t) => !t.unlockable)) {
    drawPolygon(surface, ERASER_COLOR, outline(tile), 0, true, false);
    drawPolygon(surface, ERASER_COLOR, outline(tile), lineWidth, false, false);
  }
}

export function maskTiles(
  surface: ImageData,
  tiles: EditorTile[],
  borderColor: string,
): ImageData {
  if (tiles.length === 0) return surface;
  const masked = copyOf(surface);
  fillTiles(
    masked,
    tiles,
    () => borderColor,
    borderColor,
    tileLineWidth(tiles),
  );
  return masked;
}

export function regionTiles(
  surface: ImageData,
  tiles: EditorTile[],
  borderColor: string,
): ImageData {
  const regions = copyOf(surface);
  fillTiles(
    regions,
    tiles,
    (tile) => (tile.unlockable ? LOCKED_FILL : tile.color),
    borderColor,
    tileLineWidth(tiles),
  );
  return regions;
}

function footprint(surface: ImageData, tiles: EditorTile[]): Uint8ClampedArray {
  const mask = new ImageData(surface.width, surface.height);
  fillTiles(
    mask,
    tiles,
    () => FOOTPRINT_COLOR,
    FOOTPRINT_COLOR,
    tileLineWidth(tiles),
  );
  return mask.data;
}

export function paintAroundTiles(
  surface: ImageData,
  prepared: ImageData,
  tiles: EditorTile[],
  paint: (work: ImageData) => boolean,
): { work: ImageData; changed: boolean } | null {
  const work = copyOf(prepared);
  if (!paint(work)) return null;
  const covered = footprint(surface, tiles);
  const { data } = surface;
  let changed = false;
  for (let p = 0; p < data.length; p += 4) {
    if (covered[p + 3]) continue;
    for (let c = p; c < p + 4; c++) {
      if (work.data[c] === prepared.data[c]) continue;
      data[c] = work.data[c];
      changed = true;
    }
  }
  return { work, changed };
}

export function fillableTiles(
  surface: ImageData,
  tiles: EditorTile[],
  borderColor: string,
): ImageData {
  const prepared = copyOf(surface);
  const lineWidth = tileLineWidth(tiles);
  fillTiles(
    prepared,
    tiles.filter((t) => t.unlockable),
    () => borderColor,
    borderColor,
    lineWidth,
  );
  fillTiles(
    prepared,
    tiles.filter((t) => !t.unlockable),
    (tile) => tile.color,
    borderColor,
    lineWidth,
  );
  return prepared;
}

export function tileColorIn(surface: ImageData, tile: EditorTile): string {
  return sampleColor(surface, ...tileCenter(tile.points)) ?? tile.color;
}
