import { Fill, GenerationType, MapSize } from '../mapgen/core/params';
import { DEFAULT_BORDER_COLORS } from '../mapgen/render/palette';
import {
  Game,
  GameMap,
  MapWrap,
  SeaTerritory,
  Territory,
  TimedConnection,
} from '../types';
import { withOpenConnections } from './timedConnections';

const maps = new Map<string, GameMap>();
const openMaps = new WeakMap<
  Game,
  { round: number; territories: Territory[]; open: GameMap }
>();

export function loadMaps(entries: GameMap[]): void {
  for (const entry of entries) {
    maps.set(entry.name, entry);
  }
}

function baseGameMap(game: Game): GameMap {
  if (game.generatedMap) {
    return {
      name: game.mapName,
      territories: game.generatedMap.territories,
      seaTerritories: game.generatedMap.seaTerritories,
      bonuses: game.generatedMap.bonuses,
      wraps: [],
      timedConnections: game.generatedMap.timedConnections,
    };
  }
  if (game.playerMap) {
    return {
      name: game.mapName,
      territories: game.playerMap.territories,
      seaTerritories: game.playerMap.seaTerritories,
      bonuses: game.playerMap.bonuses,
      wraps: game.playerMap.wraps,
      timedConnections: game.playerMap.timedConnections,
    };
  }
  return (
    maps.get(game.mapName) ?? {
      name: game.mapName,
      territories: [],
      seaTerritories: [],
      bonuses: [],
      wraps: [],
      timedConnections: [],
    }
  );
}

export function gameMapAtRound(game: Game, round: number): GameMap {
  const base = baseGameMap(game);
  if (base.timedConnections.length === 0) return base;
  return {
    ...base,
    territories: withOpenConnections(
      base.territories,
      base.timedConnections,
      round,
    ),
  };
}

export function getGameMap(game: Game): GameMap {
  const base = baseGameMap(game);
  if (base.timedConnections.length === 0) return base;
  const cached = openMaps.get(game);
  if (
    cached &&
    cached.round === game.roundNumber &&
    cached.territories === base.territories
  )
    return cached.open;
  const round = game.roundNumber;
  const open = gameMapAtRound(game, round);
  openMaps.set(game, { round, territories: base.territories, open });
  return open;
}

export interface ArchivedMap {
  name: string;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
  timedConnections: TimedConnection[];
  imageSrc: string | null;
  borderColors: string[];
  generation: {
    seed: string;
    size: MapSize;
    type: GenerationType;
    fill: Fill;
    seas: boolean;
    timed: boolean;
  } | null;
}

export function getArchivedMap(game: Game): ArchivedMap {
  const {
    name,
    territories,
    seaTerritories,
    bonuses,
    wraps,
    timedConnections,
  } = baseGameMap(game);
  const generated = game.generatedMap;
  return {
    name,
    territories,
    seaTerritories,
    bonuses,
    wraps,
    timedConnections,
    imageSrc: generated?.imageSrc ?? game.playerMap?.imageSrc ?? null,
    borderColors:
      generated?.borderColors ??
      game.playerMap?.borderColors ??
      DEFAULT_BORDER_COLORS,
    generation: generated
      ? {
          seed: generated.seed,
          size: generated.size,
          type: generated.type,
          fill: generated.fill,
          seas: generated.seas,
          timed: generated.timed,
        }
      : null,
  };
}

export function hasMap(game: Game): boolean {
  return game.generatedMap !== null || game.playerMap !== null;
}
