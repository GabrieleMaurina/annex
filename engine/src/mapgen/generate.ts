import { Territory } from '../types';
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

export interface GeneratedMap {
  name: string;
  territories: Territory[];
  bonuses: number[];
  imageSrc: string;
}

export function generateMap(params: GenerateMapParams): GeneratedMap {
  const { seed, size, type, fill } = params;
  const rng = createRng(`${seed}::${size}::${type}::${fill}`);
  const grid = GRID_DIMENSIONS[size];
  const dims = {
    width: grid.width * OUTPUT_SCALE,
    height: grid.height * OUTPUT_SCALE,
  };

  const built =
    type === 'dungeon'
      ? generateDungeon(rng, fill, size, dims)
      : type === 'temple'
        ? generateTemple(rng, fill, size, dims)
        : generateTerrain(rng, fill, size, dims);

  return { name: generatedMapName(params), ...built };
}
