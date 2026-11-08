import {
  Fill,
  GenerationType,
  MapAspect,
  MapSize,
  TileShape,
} from '../mapgen/core/params';
import { DEFAULT_BORDER_COLORS } from '../mapgen/render/palette';
import {
  DirectionalConnection,
  FixedTile,
  Game,
  GameMap,
  LockedTile,
  MapSwitch,
  MapWrap,
  SeaTerritory,
  SwitchedLink,
  Territory,
  TimedConnection,
} from '../types';
import { withDirectedConnections } from './directionalConnections';
import { withUnlockedTiles } from './lockedTiles';
import { switchedLinkStates, switchStates } from './switches';
import { withOpenConnections } from './timedConnections';

const maps = new Map<string, GameMap>();
const openMaps = new WeakMap<
  Game,
  {
    round: number;
    territories: Territory[];
    unlockedCount: number;
    flippedKey: string;
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
      directionalConnections: game.generatedMap.directionalConnections,
      switches: game.generatedMap.switches,
      switchedLinks: game.generatedMap.switchedLinks,
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
      directionalConnections: game.playerMap.directionalConnections,
      switches: game.playerMap.switches,
      switchedLinks: game.playerMap.switchedLinks,
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
      directionalConnections: [],
      switches: [],
      switchedLinks: [],
      lockedTiles: [],
    }
  );
}

function isStatic(game: Game, base: GameMap): boolean {
  return (
    base.timedConnections.length === 0 &&
    base.directionalConnections.length === 0 &&
    game.unlockedTileIds.size === 0
  );
}

function withContinentBonuses(game: Game, map: GameMap): GameMap {
  return game.state === 'lobby'
    ? map
    : { ...map, bonuses: game.continentBonuses };
}

export function gameMapAtRound(
  game: Game,
  round: number,
  flippedSwitchIds: ReadonlySet<number> = game.flippedSwitchIds,
): GameMap {
  const base = baseGameMap(game);
  if (isStatic(game, base)) return withContinentBonuses(game, base);
  const switched = switchedLinkStates(
    base.switchedLinks,
    switchStates(base.switches, flippedSwitchIds),
  );
  return withContinentBonuses(game, {
    ...base,
    territories: withUnlockedTiles(
      withDirectedConnections(
        withOpenConnections(
          base.territories,
          base.timedConnections,
          round,
          switched,
        ),
        base.directionalConnections,
        round,
        switched,
      ),
      base.lockedTiles,
      game.unlockedTileIds,
    ),
  });
}

export function flippedSwitchesKey(ids: ReadonlySet<number>): string {
  return [...ids].sort((a, b) => a - b).join(',');
}

export function getGameMap(game: Game): GameMap {
  const base = baseGameMap(game);
  if (isStatic(game, base)) return withContinentBonuses(game, base);
  const cached = openMaps.get(game);
  const unlockedCount = game.unlockedTileIds.size;
  const flippedKey = flippedSwitchesKey(game.flippedSwitchIds);
  if (
    cached &&
    cached.round === game.roundNumber &&
    cached.territories === base.territories &&
    cached.unlockedCount === unlockedCount &&
    cached.flippedKey === flippedKey
  )
    return withContinentBonuses(game, cached.open);
  const round = game.roundNumber;
  const open = gameMapAtRound(game, round);
  openMaps.set(game, {
    round,
    territories: base.territories,
    unlockedCount,
    flippedKey,
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
  directionalConnections: DirectionalConnection[];
  switches: MapSwitch[];
  switchedLinks: SwitchedLink[];
  lockedTiles: LockedTile[];
  fixedTiles: FixedTile[];
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
    directional: boolean;
    switched: boolean;
    unlockable: boolean;
    aspect: MapAspect;
    mountains: boolean;
    rivers: boolean;
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
    directionalConnections,
    switches,
    switchedLinks,
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
    directionalConnections,
    switches,
    switchedLinks,
    lockedTiles,
    fixedTiles: generated?.fixedTiles ?? [],
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
          directional: generated.directional,
          switched: generated.switched,
          unlockable: generated.unlockable,
          aspect: generated.aspect,
          mountains: generated.mountains,
          rivers: generated.rivers,
        }
      : null,
  };
}

export function hasMap(game: Game): boolean {
  return game.generatedMap !== null || game.playerMap !== null;
}
