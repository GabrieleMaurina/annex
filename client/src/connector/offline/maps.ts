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
  imageSrc: string;
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
          imageSrc: map.image,
        }
      : Promise.reject(new Error('map unavailable')),
  );
}
