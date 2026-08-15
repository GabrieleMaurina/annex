export const HOME_ROOM = 'home';

export interface Territory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface GameMap {
  name: string;
  territories: Territory[];
  bonuses: number[];
}

export interface Player {
  key: string;
  id: number;
  name: string;
  socketId: string;
  gameName: string | null;
}

export interface Game {
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  playerIds: number[];
  bannedIds: Set<number>;
}
