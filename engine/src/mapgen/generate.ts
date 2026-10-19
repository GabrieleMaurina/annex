import { LockedTile, SeaTerritory, Territory, TimedConnection } from '../types';
import {
  generatedMapName,
  GenerateMapParams,
  GRID_DIMENSIONS,
  OUTPUT_SCALE,
} from './core/params';
import { createRng } from './core/rng';
import { generateDungeon } from './pipeline/maze/dungeon';
import { generateTemple } from './pipeline/maze/temple';
import { generateTerrain } from './pipeline/terrain/terrainMap';
import { generateTile } from './pipeline/tile/tileMap';
import { generatedBorderColors } from './render/palette';

export interface GeneratedMap {
  name: string;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  timedConnections: TimedConnection[];
  lockedTiles: LockedTile[];
  imageSrc: string;
  borderColors: string[];
}

export function generateMap(params: GenerateMapParams): GeneratedMap {
  const { seed, size, type, fill, tile, seas, timed, unlockable } = params;
  const key = `${seed}::${size}::${type}::${fill}${type === 'tile' ? `::${tile}` : ''}`;
  const rng = createRng(key);
  const timedRng = timed ? createRng(`${key}::timed`) : null;
  const grid = GRID_DIMENSIONS[size];
  const dims = {
    width: grid.width * OUTPUT_SCALE,
    height: grid.height * OUTPUT_SCALE,
  };

  const built =
    type === 'dungeon'
      ? generateDungeon(rng, fill, size, dims, seas, timedRng)
      : type === 'temple'
        ? generateTemple(rng, fill, size, dims, seas, timedRng)
        : type === 'tile'
          ? generateTile(
              rng,
              tile,
              fill,
              size,
              dims,
              seas,
              unlockable,
              timedRng,
            )
          : generateTerrain(rng, fill, size, dims, seas, timedRng);

  return {
    name: generatedMapName(params),
    lockedTiles: [],
    ...built,
    borderColors: generatedBorderColors(type),
  };
}
