import { Fill, GenerationType, MapSize } from '../mapgen/core/params';
import { Game, GameMap, SeaTerritory, Territory } from '../types';

const maps = new Map<string, GameMap>();

export function loadMaps(entries: GameMap[]): void {
  for (const entry of entries) {
    maps.set(entry.name, entry);
  }
}

export function getGameMap(game: Game): GameMap {
  if (game.generatedMap) {
    return {
      name: game.mapName,
      territories: game.generatedMap.territories,
      seaTerritories: game.generatedMap.seaTerritories,
      bonuses: game.generatedMap.bonuses,
    };
  }
  if (game.playerMap) {
    return {
      name: game.mapName,
      territories: game.playerMap.territories,
      seaTerritories: game.playerMap.seaTerritories,
      bonuses: game.playerMap.bonuses,
    };
  }
  return (
    maps.get(game.mapName) ?? {
      name: game.mapName,
      territories: [],
      seaTerritories: [],
      bonuses: [],
    }
  );
}

export interface ArchivedMap {
  name: string;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  imageSrc: string | null;
  generation: {
    seed: string;
    size: MapSize;
    type: GenerationType;
    fill: Fill;
  } | null;
}

export function getArchivedMap(game: Game): ArchivedMap {
  const { name, territories, seaTerritories, bonuses } = getGameMap(game);
  const generated = game.generatedMap;
  return {
    name,
    territories,
    seaTerritories,
    bonuses,
    imageSrc: generated?.imageSrc ?? game.playerMap?.imageSrc ?? null,
    generation: generated
      ? {
          seed: generated.seed,
          size: generated.size,
          type: generated.type,
          fill: generated.fill,
        }
      : null,
  };
}

export function hasMap(game: Game): boolean {
  return game.generatedMap !== null || game.playerMap !== null;
}
