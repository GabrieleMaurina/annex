import type { GameMap } from 'engine';
import { httpGet } from '../../lib/http';
import type { PlayerMapDetail } from '../../lib/types';

export interface LoadedPlayerMap {
  id: string;
  name: string;
  territories: GameMap['territories'];
  seaTerritories: GameMap['seaTerritories'];
  bonuses: number[];
  wraps: GameMap['wraps'];
  timedConnections: GameMap['timedConnections'];
  lockedTiles: GameMap['lockedTiles'];
  imageSrc: string;
  borderColors: string[];
}

export function loadPlayerMap(id: string): Promise<LoadedPlayerMap> {
  return httpGet<PlayerMapDetail>(
    '/player-maps/' + encodeURIComponent(id),
  ).then((map) =>
    'territories' in map
      ? {
          id: map.id,
          name: map.name,
          territories: map.territories,
          seaTerritories: map.seaTerritories,
          bonuses: map.bonuses,
          wraps: map.wraps,
          timedConnections: map.timedConnections,
          lockedTiles: map.lockedTiles,
          imageSrc: map.image,
          borderColors: map.borderColors,
        }
      : Promise.reject(new Error('map unavailable')),
  );
}
