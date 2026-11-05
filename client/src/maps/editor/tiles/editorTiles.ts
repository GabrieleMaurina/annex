import type { FixedTile, LockedTile } from '../../../lib/types';
import type { EditorTerritory as Territory } from '../model/editorTypes';
import type { EditorLockedTile } from '../model/lockedTiles';

export type TilePoint = [number, number];
export type TileKind = 'triangles' | 'squares' | 'hexagons';
export const TILE_KINDS: TileKind[] = ['triangles', 'squares', 'hexagons'];
export const TILE_FILL = '#ffffff';

export interface EditorTile {
  points: TilePoint[];
  unlockable: boolean;
  territoryId: number;
  color: string;
}

export const EDGE_TOLERANCE = 0.5;

export function tileCenter(points: TilePoint[]): TilePoint {
  return [
    points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length,
  ];
}

export function tileRadius(points: TilePoint[]): number {
  const [cx, cy] = tileCenter(points);
  return Math.max(...points.map(([x, y]) => Math.hypot(x - cx, y - cy)));
}

function samePoint(a: TilePoint, b: TilePoint): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < EDGE_TOLERANCE;
}

function sharesEdge(a: TilePoint[], b: TilePoint[]): boolean {
  const [ax, ay] = tileCenter(a);
  const [bx, by] = tileCenter(b);
  if (Math.hypot(ax - bx, ay - by) > tileRadius(a) + tileRadius(b))
    return false;
  return a.some((p, i) => {
    const q = a[(i + 1) % a.length];
    return b.some(
      (r, j) => samePoint(p, b[(j + 1) % b.length]) && samePoint(q, r),
    );
  });
}

export function tileNeighbors(
  tiles: EditorTile[],
  points: TilePoint[],
  skip: number | null,
): number[] {
  return tiles.flatMap((tile, k) =>
    k !== skip && sharesEdge(tile.points, points) ? [tile.territoryId] : [],
  );
}

export function toEditorTiles(
  lockedTiles: LockedTile[],
  fixedTiles: FixedTile[],
): EditorTile[] {
  return [
    ...fixedTiles.map((tile) => ({
      points: tile.points,
      unlockable: false,
      territoryId: tile.id,
      color: tile.color,
    })),
    ...lockedTiles.map((tile) => ({
      points: tile.points,
      unlockable: true,
      territoryId: tile.id,
      color: TILE_FILL,
    })),
  ];
}

export function roundedPoints(points: TilePoint[]): TilePoint[] {
  return points.map(([x, y]): TilePoint => [
    Math.round(x * 10) / 10,
    Math.round(y * 10) / 10,
  ]);
}

export function remapTiles(
  tiles: EditorTile[],
  idMap: Map<number, number>,
): EditorTile[] {
  return tiles.map((tile) => ({
    ...tile,
    territoryId: idMap.get(tile.territoryId) ?? tile.territoryId,
  }));
}

export function lockedLinks(
  tiles: EditorTile[],
  territories: Territory[],
): EditorLockedTile[] {
  const byId = new Map(territories.map((t) => [t.id, t]));
  const locked = tiles.filter((tile) => tile.unlockable);
  const lockedIndex = new Map(locked.map((tile, k) => [tile.territoryId, k]));
  return locked.map((tile) => {
    const [x, y] = tileCenter(tile.points);
    const neighbors = byId.get(tile.territoryId)?.neighbors ?? [];
    return {
      x: Math.round(x),
      y: Math.round(y),
      points: roundedPoints(tile.points),
      land: neighbors.filter((n) => !lockedIndex.has(n)),
      tiles: neighbors.flatMap((n) => {
        const k = lockedIndex.get(n);
        return k === undefined ? [] : [k];
      }),
    };
  });
}

export function placeTileTerritory(
  territories: Territory[],
  id: number,
  center: TilePoint,
  before: number[],
  after: number[],
): Territory[] {
  const dropped = before.filter((n) => !after.includes(n));
  return territories.map((t) => {
    if (t.id === id)
      return {
        ...t,
        x: center[0],
        y: center[1],
        neighbors: [
          ...t.neighbors.filter(
            (n) => !dropped.includes(n) && !after.includes(n),
          ),
          ...after,
        ],
      };
    if (dropped.includes(t.id))
      return { ...t, neighbors: t.neighbors.filter((n) => n !== id) };
    if (after.includes(t.id) && !t.neighbors.includes(id))
      return { ...t, neighbors: [...t.neighbors, id] };
    return t;
  });
}
