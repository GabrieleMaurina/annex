import { MapSize, WaterLevel } from '../mapgen/core/params';
import { Game, GameMap, Territory } from '../types';

export const BUILTIN_MAP_NAMES = ['World', 'Europe'];

const maps = new Map<string, GameMap>();

export function loadMaps(entries: GameMap[]): void {
  for (const entry of entries) {
    maps.set(entry.name, entry);
  }
}

export function listMapNames(): string[] {
  return [...maps.keys()];
}

export function defaultMapName(): string {
  return maps.has('World') ? 'World' : [...maps.keys()][0];
}

export function getGameMap(game: Game): GameMap {
  if (game.generatedMap) {
    return {
      name: game.mapName,
      territories: game.generatedMap.territories,
      bonuses: game.generatedMap.bonuses,
    };
  }
  return maps.get(game.mapName)!;
}

export interface ArchivedMap {
  name: string;
  territories: Territory[];
  bonuses: number[];
  imageSrc: string | null;
  generation: { seed: string; size: MapSize; water: WaterLevel } | null;
}

export function getArchivedMap(game: Game): ArchivedMap {
  const { name, territories, bonuses } = getGameMap(game);
  const generated = game.generatedMap;
  return {
    name,
    territories,
    bonuses,
    imageSrc: generated?.imageSrc ?? null,
    generation: generated
      ? { seed: generated.seed, size: generated.size, water: generated.water }
      : null,
  };
}
