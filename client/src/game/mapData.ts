import { httpGet } from '../lib/http';

export interface Territory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

export const DEFAULT_IMAGE_WIDTH = 2560;
export const DEFAULT_IMAGE_HEIGHT = 1440;

export interface GeneratedMapData {
  territories: Territory[];
  bonuses: number[];
  imageSrc: string;
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
    bonuses?: number[];
    image?: string;
  }>('/player-maps/' + encodeURIComponent(playerMapId))
    .then((map) => {
      if (map.territories && map.bonuses && map.image) {
        registerGeneratedMap(mapName, {
          territories: map.territories,
          bonuses: map.bonuses,
          imageSrc: map.image,
        });
        fetchedPlayerMapIds.add(playerMapId);
      }
    })
    .catch(() => {});
}

const EMPTY_MAP = {
  territories: [] as Territory[],
  bonuses: [],
  imageSrc: null,
};

export function loadGameMap(
  mapName: string,
  playerMapId?: string | null,
): Promise<{
  territories: Territory[];
  bonuses: number[];
  imageSrc: string | null;
}> {
  return ensurePlayerMap(mapName, playerMapId).then(
    () => generatedMaps.get(mapName) ?? EMPTY_MAP,
  );
}
