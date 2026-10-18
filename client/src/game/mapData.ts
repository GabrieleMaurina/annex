import { DEFAULT_BORDER_COLORS } from 'engine';
import { httpGet } from '../lib/http';
import type { MapWrap, TimedConnection } from '../lib/types';

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
  imageSrc: string;
  borderColors: string[];
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
    image?: string;
    borderColors: string[];
  }>('/player-maps/' + encodeURIComponent(playerMapId))
    .then((map) => {
      if (map.territories && map.bonuses && map.image) {
        registerGeneratedMap(mapName, {
          territories: map.territories,
          seaTerritories: map.seaTerritories ?? [],
          bonuses: map.bonuses,
          wraps: map.wraps ?? [],
          timedConnections: map.timedConnections ?? [],
          imageSrc: map.image,
          borderColors: map.borderColors,
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
  imageSrc: null,
  borderColors: DEFAULT_BORDER_COLORS,
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
  imageSrc: string | null;
  borderColors: string[];
}> {
  return ensurePlayerMap(mapName, playerMapId).then(
    () => generatedMaps.get(mapName) ?? EMPTY_MAP,
  );
}
