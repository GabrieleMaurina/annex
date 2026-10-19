import { useState } from 'react';
import type { LockedTile } from '../../../lib/types';
import type { EditorTerritory } from './editorTypes';

export interface EditorLockedTile {
  x: number;
  y: number;
  points: [number, number][];
  land: number[];
  tiles: number[];
}

export function toEditorLockedTiles(
  lockedTiles: LockedTile[],
): EditorLockedTile[] {
  const indexById = new Map(lockedTiles.map((tile, k) => [tile.id, k]));
  return lockedTiles.map((tile) => ({
    x: tile.x,
    y: tile.y,
    points: tile.points,
    land: tile.neighbors.filter((n) => !indexById.has(n)),
    tiles: tile.neighbors.flatMap((n) => {
      const k = indexById.get(n);
      return k === undefined ? [] : [k];
    }),
  }));
}

export function useLockedTiles(territories: EditorTerritory[]) {
  const [lockedTiles, setLockedTiles] = useState<EditorLockedTile[]>([]);
  const [prevTerritories, setPrevTerritories] = useState(territories);
  if (territories !== prevTerritories) {
    setPrevTerritories(territories);
    const ids = new Set(territories.map((t) => t.id));
    if (lockedTiles.some((tile) => tile.land.some((n) => !ids.has(n))))
      setLockedTiles(
        lockedTiles.map((tile) => ({
          ...tile,
          land: tile.land.filter((n) => ids.has(n)),
        })),
      );
  }
  return [lockedTiles, setLockedTiles] as const;
}

function mapLand(land: number[], idMap: Map<number, number>): number[] {
  return land.flatMap((id) => {
    const mapped = idMap.get(id);
    return mapped === undefined ? [] : [mapped];
  });
}

export function remapLockedTiles(
  tiles: EditorLockedTile[],
  idMap: Map<number, number>,
): EditorLockedTile[] {
  return tiles.map((tile) => ({ ...tile, land: mapLand(tile.land, idMap) }));
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
