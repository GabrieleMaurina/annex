import type { LockedTile } from '../../../lib/types';

export interface EditorLockedTile {
  x: number;
  y: number;
  points: [number, number][];
  land: number[];
  tiles: number[];
}

function mapLand(land: number[], idMap: Map<number, number>): number[] {
  return land.flatMap((id) => {
    const mapped = idMap.get(id);
    return mapped === undefined ? [] : [mapped];
  });
}

export function toLockedTiles(
  tiles: EditorLockedTile[],
  idMap: Map<number, number>,
  firstId: number,
): LockedTile[] {
  return tiles.map((tile, k) => ({
    id: firstId + k,
    x: tile.x,
    y: tile.y,
    points: tile.points,
    neighbors: [
      ...mapLand(tile.land, idMap),
      ...tile.tiles.map((other) => firstId + other),
    ].sort((a, b) => a - b),
  }));
}
