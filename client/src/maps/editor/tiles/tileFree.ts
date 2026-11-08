import {
  insetPolygon,
  TILE_LINE_WIDTH,
} from '../../../game/tiles/tileGeometry';
import { tileCenter, type EditorTile, type TilePoint } from './editorTiles';
import { contains, overlaps } from './snapTiles';

const WHITE = 255;

interface Vertex {
  x: number;
  y: number;
}

type Backdrop = [number, number, number];

function isBlank(
  data: Uint8ClampedArray,
  index: number,
  backdrop: Backdrop,
): boolean {
  return (
    data[index + 3] === 0 ||
    (data[index] === backdrop[0] &&
      data[index + 1] === backdrop[1] &&
      data[index + 2] === backdrop[2])
  );
}

function paintedUnder(
  surface: ImageData,
  points: TilePoint[],
  backdrop: Backdrop,
): boolean {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const xEnd = Math.min(surface.width - 1, Math.ceil(Math.max(...xs)));
  const yEnd = Math.min(surface.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= yEnd; y++)
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= xEnd; x++)
      if (
        contains(points, [x + 0.5, y + 0.5]) &&
        !isBlank(surface.data, (y * surface.width + x) * 4, backdrop)
      )
        return true;
  return false;
}

export function tileFreeCheck(
  tiles: EditorTile[],
  vertices: Vertex[],
  surface: ImageData,
  generated: boolean,
): (points: TilePoint[]) => boolean {
  const cache = new Map<string, boolean>();
  const backdrop: Backdrop = generated
    ? [surface.data[0], surface.data[1], surface.data[2]]
    : [WHITE, WHITE, WHITE];
  function isFree(points: TilePoint[]): boolean {
    const [cx, cy] = tileCenter(points);
    if (cx < 0 || cy < 0 || cx > surface.width || cy > surface.height)
      return false;
    if (tiles.some((tile) => overlaps(tile.points, points))) return false;
    if (vertices.some((v) => contains(points, [v.x, v.y]))) return false;
    return !paintedUnder(
      surface,
      insetPolygon(points, TILE_LINE_WIDTH),
      backdrop,
    );
  }
  return (points) => {
    const [cx, cy] = tileCenter(points);
    const key = `${points.length}:${cx.toFixed(2)},${cy.toFixed(2)}`;
    let free = cache.get(key);
    if (free === undefined) {
      free = isFree(points);
      cache.set(key, free);
    }
    return free;
  };
}
