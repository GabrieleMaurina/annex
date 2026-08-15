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

export type DiceRandomness = 'Balanced' | 'True';
export type CardsMode = 'Fixed' | 'Progressive' | 'Exponential';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode =
  'World Domination' | 'Capital Conquest' | 'Team Deathmatch';

export interface Game {
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  phase: 'lobby' | 'playing';
  gameMode: GameMode;
  diceRandomness: DiceRandomness;
  defenceDice: 2 | 3;
  cards: CardsMode;
  turnDuration: TurnDuration;
  playerIds: number[];
  spectatorIds: number[];
  playerTeams: Map<number, number>;
  playerColors: Map<number, number>;
  bannedIds: Set<number>;
}
