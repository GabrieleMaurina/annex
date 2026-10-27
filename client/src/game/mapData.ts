import { DEFAULT_BORDER_COLORS } from 'engine';
import { httpGet } from '../lib/http';
import type { LockedTile, MapWrap, TimedConnection } from '../lib/types';

export interface Territory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface SeaTerritory {
  id: number;
  x: number;
  y: number;
  neighbors: number[];
}

export const DEFAULT_IMAGE_WIDTH = 2560;
export const DEFAULT_IMAGE_HEIGHT = 1440;

export interface GeneratedMapData {
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
  timedConnections: TimedConnection[];
  lockedTiles: LockedTile[];
  imageSrc: string;
  borderColors: string[];
  territoryNames: string[] | null;
  seaNames: string[] | null;
  continentNames: string[] | null;
}

const generatedMaps = new Map<string, GeneratedMapData>();

export function registerGeneratedMap(
  name: string,
  data: GeneratedMapData,
): void {
  generatedMaps.set(name, data);
}

export function getGeneratedMapData(
  mapName: string,
): GeneratedMapData | undefined {
  return generatedMaps.get(mapName);
}

export interface PlaceNames {
  territories: Map<number, string>;
  continents: Map<number, string>;
}

export const NO_PLACE_NAMES: PlaceNames = {
  territories: new Map(),
  continents: new Map(),
};

const placeNamesCache = new WeakMap<GeneratedMapData, PlaceNames>();

export function placeNamesFor(mapName: string): PlaceNames {
  const data = generatedMaps.get(mapName);
  if (!data) return NO_PLACE_NAMES;
  const cached = placeNamesCache.get(data);
  if (cached) return cached;
  const territories = new Map<number, string>();
  data.territories.forEach((t, i) => {
    const name = data.territoryNames?.[i];
    if (name) territories.set(t.id, name);
  });
  data.seaTerritories.forEach((s, i) => {
    const name = data.seaNames?.[i];
    if (name) territories.set(s.id, name);
  });
  const continents = new Map<number, string>();
  data.continentNames?.forEach((name, i) => {
    if (name) continents.set(i, name);
  });
  const names = { territories, continents };
  placeNamesCache.set(data, names);
  return names;
}

const fetchedPlayerMapIds = new Set<string>();

function ensurePlayerMap(
  mapName: string,
  playerMapId?: string | null,
): Promise<void> {
  if (
    !playerMapId ||
    fetchedPlayerMapIds.has(playerMapId) ||
    generatedMaps.has(mapName)
  )
    return Promise.resolve();
  return httpGet<{
    territories?: Territory[];
    seaTerritories?: SeaTerritory[];
    bonuses?: number[];
    wraps?: MapWrap[];
    timedConnections?: TimedConnection[];
    lockedTiles?: LockedTile[];
    image?: string;
    borderColors: string[];
    territoryNames?: string[] | null;
    seaNames?: string[] | null;
    continentNames?: string[] | null;
  }>('/player-maps/' + encodeURIComponent(playerMapId))
    .then((map) => {
      if (map.territories && map.bonuses && map.image) {
        registerGeneratedMap(mapName, {
          territories: map.territories,
          seaTerritories: map.seaTerritories ?? [],
          bonuses: map.bonuses,
          wraps: map.wraps ?? [],
          timedConnections: map.timedConnections ?? [],
          lockedTiles: map.lockedTiles ?? [],
          imageSrc: map.image,
          borderColors: map.borderColors,
          territoryNames: map.territoryNames ?? null,
          seaNames: map.seaNames ?? null,
          continentNames: map.continentNames ?? null,
        });
        fetchedPlayerMapIds.add(playerMapId);
      }
    })
    .catch(() => {});
}

const EMPTY_MAP = {
  territories: [] as Territory[],
  seaTerritories: [] as SeaTerritory[],
  bonuses: [],
  wraps: [] as MapWrap[],
  timedConnections: [] as TimedConnection[],
  lockedTiles: [] as LockedTile[],
  imageSrc: null,
  borderColors: DEFAULT_BORDER_COLORS,
  territoryNames: null,
  seaNames: null,
  continentNames: null,
};

export function loadGameMap(
  mapName: string,
  playerMapId?: string | null,
): Promise<{
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
}> {
  return ensurePlayerMap(mapName, playerMapId).then(
    () => generatedMaps.get(mapName) ?? EMPTY_MAP,
  );
}
