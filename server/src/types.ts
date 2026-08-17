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
  connected: boolean;
}

export type DiceRandomness = 'Balanced' | 'True';
export type DefenceDice = 2 | 3;
export type CardsMode = 'Fixed' | 'Progressive' | 'Exponential';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode =
  'World Domination' | 'Capital Conquest' | 'Team Deathmatch';
export type TurnPhase = 'deploy' | 'attack' | 'fortify';

export interface Game {
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  state: 'lobby' | 'playing';
  gameMode: GameMode;
  diceRandomness: DiceRandomness;
  defenceDice: DefenceDice;
  cards: CardsMode;
  turnDuration: TurnDuration;
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  troopsToDeploy: number;
  turnStartedAt: number;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  playerIds: number[];
  spectatorIds: number[];
  playerTeams: Map<number, number>;
  playerColors: Map<number, number>;
  bannedIds: Set<number>;
  territoryOwners: Map<number, number>;
  territoryTroops: Map<number, number>;
  hostPriority: number[];
  surrenderedIds: Set<number>;
}
