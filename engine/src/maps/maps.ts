import {
  Fill,
  GenerationType,
  MapAspect,
  MapSize,
  TileShape,
} from '../mapgen/core/params';
import { DEFAULT_BORDER_COLORS } from '../mapgen/render/palette';
import {
  Game,
  GameMap,
  LockedTile,
  MapWrap,
  SeaTerritory,
  Territory,
  TimedConnection,
} from '../types';
import { withUnlockedTiles } from './lockedTiles';
import { withOpenConnections } from './timedConnections';

const maps = new Map<string, GameMap>();
const openMaps = new WeakMap<
  Game,
  {
    round: number;
    territories: Territory[];
    unlockedCount: number;
    open: GameMap;
  }
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
      lockedTiles: game.generatedMap.lockedTiles,
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
      lockedTiles: game.playerMap.lockedTiles,
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
      lockedTiles: [],
    }
  );
}

function isStatic(game: Game, base: GameMap): boolean {
  return base.timedConnections.length === 0 && game.unlockedTileIds.size === 0;
}

export function gameMapAtRound(game: Game, round: number): GameMap {
  const base = baseGameMap(game);
  if (isStatic(game, base)) return base;
  return {
    ...base,
    territories: withUnlockedTiles(
      withOpenConnections(base.territories, base.timedConnections, round),
      base.lockedTiles,
      game.unlockedTileIds,
    ),
  };
}

export function getGameMap(game: Game): GameMap {
  const base = baseGameMap(game);
  if (isStatic(game, base)) return base;
  const cached = openMaps.get(game);
  const unlockedCount = game.unlockedTileIds.size;
  if (
    cached &&
    cached.round === game.roundNumber &&
    cached.territories === base.territories &&
    cached.unlockedCount === unlockedCount
  )
    return cached.open;
  const round = game.roundNumber;
  const open = gameMapAtRound(game, round);
  openMaps.set(game, {
    round,
    territories: base.territories,
    unlockedCount,
    open,
  });
  return open;
}

export interface ArchivedMap {
  name: string;
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
  timedConnections: TimedConnection[];
  lockedTiles: LockedTile[];
  imageSrc: string | null;
  borderColors: string[];
  territoryNames: string[] | null;
  seaNames: string[] | null;
  continentNames: string[] | null;
  generation: {
    seed: string;
    size: MapSize;
    type: GenerationType;
    fill: Fill;
    tile: TileShape;
    seas: boolean;
    timed: boolean;
    unlockable: boolean;
    aspect: MapAspect;
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
    lockedTiles,
  } = baseGameMap(game);
  const generated = game.generatedMap;
  return {
    name,
    territories,
    seaTerritories,
    bonuses,
    wraps,
    timedConnections,
    lockedTiles,
    imageSrc: generated?.imageSrc ?? game.playerMap?.imageSrc ?? null,
    borderColors:
      generated?.borderColors ??
      game.playerMap?.borderColors ??
      DEFAULT_BORDER_COLORS,
    territoryNames: game.playerMap?.territoryNames ?? null,
    seaNames: game.playerMap?.seaNames ?? null,
    continentNames: game.playerMap?.continentNames ?? null,
    generation: generated
      ? {
          seed: generated.seed,
          size: generated.size,
          type: generated.type,
          fill: generated.fill,
          tile: generated.tile,
          seas: generated.seas,
          timed: generated.timed,
          unlockable: generated.unlockable,
          aspect: generated.aspect,
        }
      : null,
  };
}

export function hasMap(game: Game): boolean {
  return game.generatedMap !== null || game.playerMap !== null;
}
