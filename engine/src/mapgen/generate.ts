import {
  DirectionalConnection,
  LockedTile,
  SeaTerritory,
  Territory,
  TimedConnection,
} from '../types';
import {
  generatedMapName,
  GenerateMapParams,
  mapImageSize,
} from './core/params';
import { createRng } from './core/rng';
import { createLinkRngs } from './links';
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
  directionalConnections: DirectionalConnection[];
  lockedTiles: LockedTile[];
  imageSrc: string;
  borderColors: string[];
}

export function generateMap(params: GenerateMapParams): GeneratedMap {
  const {
    seed,
    size,
    type,
    fill,
    tile,
    seas,
    timed,
    directional,
    unlockable,
    aspect,
    mountains,
    rivers,
  } = params;
  const key = `${seed}::${size}::${type}::${fill}${type === 'tile' ? `::${tile}` : ''}${aspect === 'square' ? '::square' : ''}`;
  const rng = createRng(key);
  const linkRngs = createLinkRngs(key, timed, directional);
  const dims = mapImageSize(size, aspect);

  const built =
    type === 'dungeon'
      ? generateDungeon(rng, fill, size, dims, seas, linkRngs)
      : type === 'temple'
        ? generateTemple(rng, fill, size, dims, seas, linkRngs)
        : type === 'tile'
          ? generateTile(
              rng,
              tile,
              fill,
              size,
              dims,
              seas,
              unlockable,
              linkRngs,
            )
          : generateTerrain(rng, fill, size, dims, seas, linkRngs, {
              mountains,
              rivers,
            });

  return {
    name: generatedMapName(params),
    lockedTiles: [],
    ...built,
    borderColors: generatedBorderColors(type, rivers),
  };
}
