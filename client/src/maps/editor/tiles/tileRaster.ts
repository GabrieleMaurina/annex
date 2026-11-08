import { TILE_LINE_WIDTH } from '../../../game/tiles/tileGeometry';
import { drawLine, drawPolygon } from '../paint/paintTools';
import type { EditorTile, TilePoint } from './editorTiles';

export interface TileLook {
  wall: string;
  seam: string;
  seams: boolean[][];
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Drawn {
  tiles: EditorTile[];
  selected: number | null;
  look: TileLook;
  width: number;
  height: number;
}

const LOCKED_FILL = '#d9d9d9';
const SELECTED_COLOR = '#0d6efd';
const GHOST_ALPHA = 0.5;
const REACH = TILE_LINE_WIDTH + 1;
const NOTHING: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };

export function edgesOf(
  tiles: EditorTile[],
  look: TileLook,
  seam: boolean,
  include: (index: number) => boolean = () => true,
): [TilePoint, TilePoint][] {
  return tiles.flatMap((tile, k) =>
    include(k)
      ? tile.points.flatMap((p, i): [TilePoint, TilePoint][] =>
          (look.seams[k]?.[i] ?? false) === seam
            ? [[p, tile.points[(i + 1) % tile.points.length]]]
            : [],
        )
      : [],
  );
}

function boundsOfPolygons(polygons: TilePoint[][]): Rect | null {
  const points = polygons.flat();
  if (points.length === 0) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    x0: Math.floor(Math.min(...xs) - REACH),
    y0: Math.floor(Math.min(...ys) - REACH),
    x1: Math.ceil(Math.max(...xs) + REACH),
    y1: Math.ceil(Math.max(...ys) + REACH),
  };
}

function clipped(rect: Rect, width: number, height: number): Rect {
  return {
    x0: Math.max(0, rect.x0),
    y0: Math.max(0, rect.y0),
    x1: Math.min(width, rect.x1),
    y1: Math.min(height, rect.y1),
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

export function fillOf(tile: EditorTile): string {
  return tile.unlockable ? LOCKED_FILL : tile.color;
}

function sameSeams(a: boolean[] | undefined, b: boolean[] | undefined) {
  return (a ?? []).join() === (b ?? []).join();
}

export function changedRegion(prev: Drawn | null, next: Drawn): Rect | null {
  if (
    !prev ||
    prev.width !== next.width ||
    prev.height !== next.height ||
    prev.look.wall !== next.look.wall ||
    prev.look.seam !== next.look.seam
  )
    return null;
  const before = new Map(prev.tiles.map((tile, k) => [tile.territoryId, k]));
  const after = new Set(next.tiles.map((tile) => tile.territoryId));
  const dirty: TilePoint[][] = [];
  next.tiles.forEach((tile, k) => {
    const j = before.get(tile.territoryId);
    if (
      j !== undefined &&
      prev.tiles[j] === tile &&
      sameSeams(prev.look.seams[j], next.look.seams[k])
    )
      return;
    dirty.push(tile.points);
    if (j !== undefined) dirty.push(prev.tiles[j].points);
  });
  for (const tile of prev.tiles)
    if (!after.has(tile.territoryId)) dirty.push(tile.points);
  for (const [tiles, selected] of [
    [prev.tiles, prev.selected],
    [next.tiles, next.selected],
  ] as const)
    if (selected !== null && tiles[selected])
      dirty.push(tiles[selected].points);
  return boundsOfPolygons(dirty) ?? NOTHING;
}

export function drawTileLayer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  tiles: EditorTile[],
  selected: number | null,
  look: TileLook,
  dirty: Rect | null,
): boolean {
  const resized = canvas.width !== width || canvas.height !== height;
  if (resized) {
    canvas.width = width;
    canvas.height = height;
  }
  const area = clipped(
    resized || !dirty ? { x0: 0, y0: 0, x1: width, y1: height } : dirty,
    width,
    height,
  );
  const w = area.x1 - area.x0;
  const h = area.y1 - area.y0;
  if (w <= 0 || h <= 0) return false;
  const near = new Set(
    tiles.flatMap((tile, k) => {
      const bounds = boundsOfPolygons([tile.points]);
      return bounds && overlaps(bounds, area) ? [k] : [];
    }),
  );
  const shift = (p: TilePoint) => ({ x: p[0] - area.x0, y: p[1] - area.y0 });
  const scratch = new ImageData(w, h);
  for (const k of near)
    drawPolygon(
      scratch,
      fillOf(tiles[k]),
      tiles[k].points.map(shift),
      0,
      true,
      false,
    );
  for (const seam of [true, false])
    for (const [from, to] of edgesOf(tiles, look, seam, (k) => near.has(k)))
      drawLine(
        scratch,
        seam ? look.seam : look.wall,
        TILE_LINE_WIDTH,
        shift(from),
        shift(to),
      );
  if (selected !== null && near.has(selected))
    drawPolygon(
      scratch,
      SELECTED_COLOR,
      tiles[selected].points.map(shift),
      TILE_LINE_WIDTH,
      false,
      false,
    );
  canvas.getContext('2d')!.putImageData(scratch, area.x0, area.y0);
  return true;
}

export function drawGhostLayer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  ghosts: EditorTile[],
  wall: string,
  previous: Rect | null,
): Rect | null {
  const resized = canvas.width !== width || canvas.height !== height;
  if (resized) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d')!;
  if (previous && !resized)
    ctx.clearRect(
      previous.x0,
      previous.y0,
      previous.x1 - previous.x0,
      previous.y1 - previous.y0,
    );
  const bounds = boundsOfPolygons(ghosts.map((ghost) => ghost.points));
  if (!bounds) return null;
  const area = clipped(bounds, width, height);
  const w = area.x1 - area.x0;
  const h = area.y1 - area.y0;
  if (w <= 0 || h <= 0) return null;
  const shift = (p: TilePoint) => ({ x: p[0] - area.x0, y: p[1] - area.y0 });
  const scratch = new ImageData(w, h);
  for (const ghost of ghosts)
    drawPolygon(
      scratch,
      fillOf(ghost),
      ghost.points.map(shift),
      0,
      true,
      false,
    );
  for (const ghost of ghosts)
    drawPolygon(
      scratch,
      wall,
      ghost.points.map(shift),
      TILE_LINE_WIDTH,
      false,
      false,
    );
  const staging = document.createElement('canvas');
  staging.width = w;
  staging.height = h;
  staging.getContext('2d')!.putImageData(scratch, 0, 0);
  ctx.globalAlpha = GHOST_ALPHA;
  ctx.drawImage(staging, area.x0, area.y0);
  ctx.globalAlpha = 1;
  return area;
}
