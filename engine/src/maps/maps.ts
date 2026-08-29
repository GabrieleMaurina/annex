import { Game, GameMap } from '../types';

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
