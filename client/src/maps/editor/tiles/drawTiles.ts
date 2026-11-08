import { TILE_LINE_WIDTH } from '../../../game/tiles/tileGeometry';
import {
  drawLine,
  drawPolygon,
  ERASER_COLOR,
  sampleColor,
} from '../paint/paintTools';
import { tileCenter, type EditorTile } from './editorTiles';
import { edgesOf, fillOf, type TileLook } from './tileRaster';

export interface TileDecor {
  ghosts: EditorTile[];
}

const ERASE_MARGIN = 2;
const FOOTPRINT_COLOR = '#000000';

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
  look: TileLook,
): ImageData {
  const baked = copyOf(surface);
  for (const tile of tiles.filter((t) => !t.unlockable))
    drawPolygon(baked, tile.color, outline(tile), 0, true, false);
  for (const seam of [true, false])
    for (const [from, to] of edgesOf(
      tiles,
      look,
      seam,
      (k) => !tiles[k].unlockable,
    ))
      drawLine(
        baked,
        seam ? look.seam : look.wall,
        TILE_LINE_WIDTH,
        { x: from[0], y: from[1] },
        { x: to[0], y: to[1] },
      );
  return baked;
}

export function eraseTiles(
  surface: ImageData,
  tiles: EditorTile[],
  generated: boolean,
) {
  const lineWidth = TILE_LINE_WIDTH + ERASE_MARGIN;
  const backdrop = generated
    ? (sampleColor(surface, 0, 0) ?? ERASER_COLOR)
    : ERASER_COLOR;
  for (const tile of tiles.filter((t) => !t.unlockable)) {
    drawPolygon(surface, backdrop, outline(tile), 0, true, false);
    drawPolygon(surface, backdrop, outline(tile), lineWidth, false, false);
  }
}

export function maskTiles(
  surface: ImageData,
  tiles: EditorTile[],
  borderColor: string,
): ImageData {
  if (tiles.length === 0) return surface;
  const masked = copyOf(surface);
  fillTiles(masked, tiles, () => borderColor, borderColor, TILE_LINE_WIDTH);
  return masked;
}

export function regionTiles(
  surface: ImageData,
  tiles: EditorTile[],
  borderColor: string,
): ImageData {
  const regions = copyOf(surface);
  fillTiles(regions, tiles, fillOf, borderColor, TILE_LINE_WIDTH);
  return regions;
}

function footprint(surface: ImageData, tiles: EditorTile[]): Uint8ClampedArray {
  const mask = new ImageData(surface.width, surface.height);
  fillTiles(
    mask,
    tiles,
    () => FOOTPRINT_COLOR,
    FOOTPRINT_COLOR,
    TILE_LINE_WIDTH,
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
  fillTiles(
    prepared,
    tiles.filter((t) => t.unlockable),
    () => borderColor,
    borderColor,
    TILE_LINE_WIDTH,
  );
  fillTiles(
    prepared,
    tiles.filter((t) => !t.unlockable),
    (tile) => tile.color,
    borderColor,
    TILE_LINE_WIDTH,
  );
  return prepared;
}

export function tileColorIn(surface: ImageData, tile: EditorTile): string {
  return sampleColor(surface, ...tileCenter(tile.points)) ?? tile.color;
}
