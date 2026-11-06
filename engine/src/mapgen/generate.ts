import {
  DirectionalConnection,
  LockedTile,
  MapSwitch,
  SeaTerritory,
  SwitchedLink,
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
import { generateTile, layTileShape } from './pipeline/tile/tileMap';
import { Point } from './pipeline/tile/tiling';
import { generatedBorderColors } from './render/palette';
import { generateSwitches } from './switches';

export interface GeneratedMap {
  name: string;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
  switches: MapSwitch[];
  switchedLinks: SwitchedLink[];
  lockedTiles: LockedTile[];
  imageSrc: string;
  borderColors: string[];
}

function generationKey({
  seed,
  size,
  type,
  fill,
  tile,
  aspect,
}: GenerateMapParams): string {
  return `${seed}::${size}::${type}::${fill}${type === 'tile' ? `::${tile}` : ''}${aspect === 'square' ? '::square' : ''}`;
}

export function generatedTileGrid(params: GenerateMapParams): {
  tiles: Point[][];
  width: number;
  height: number;
} {
  const { tiles, kept, dims } = layTileShape(
    createRng(generationKey(params)),
    params.tile,
    params.fill,
    params.size,
    mapImageSize(params.size, params.aspect),
  );
  return { tiles: tiles.filter((_, t) => kept[t]), ...dims };
}

export function generateMap(params: GenerateMapParams): GeneratedMap {
  const {
    size,
    type,
    fill,
    tile,
    seas,
    timed,
    directional,
    switched,
    unlockable,
    aspect,
    mountains,
    rivers,
  } = params;
  const key = generationKey(params);
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
    ...generateSwitches(
      switched ? createRng(`${key}::switches`) : null,
      built.territories,
      [...built.timedConnections, ...built.directionalConnections],
      dims,
    ),
    borderColors: generatedBorderColors(type, rivers),
  };
}
