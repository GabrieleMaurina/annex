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

export type CardSymbol = 'soldier' | 'humvee' | 'tank';

export interface Card {
  territoryId: number | null;
  symbol: CardSymbol | null;
}

export type Blitz = 'Balanced' | 'True';
export type DefenceDice = 2 | 3;
export type CardsMode = 'Constant' | 'Linear' | 'Exponential';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode = 'Supremacy' | 'Capitals' | 'Team Deathmatch';
export type TurnPhase = 'capital' | 'deploy' | 'attack' | 'fortify';

export type ReplayAnimation =
  | { type: 'deploy'; territoryId: number; troops: number; playerId: number }
  | {
      type: 'fortify';
      fromTerritoryId: number;
      toTerritoryId: number;
      troops: number;
      playerId: number;
    }
  | {
      type: 'attack';
      attackingTerritoryId: number;
      defendingTerritoryId: number;
      attackerId: number;
      defenderId: number;
      attackLosses: number;
      defenceLosses: number;
    };

export interface ReplayTerritory {
  id: number;
  ownerId: number;
  troops: number;
}

export interface ReplayFrame {
  territories: ReplayTerritory[];
  animation: ReplayAnimation;
  turnNumber: number;
  playerId: number;
}

export interface PlayerStats {
  troopsGained: number;
  troopsKilled: number;
  troopsLost: number;
  territoriesConquered: number;
  territoriesLost: number;
  capitalsConquered: number;
  capitalsLost: number;
  cardsGained: number;
  playersKilled: number[];
  turnsPlayed: number;
  setsPlayed: number;
  connectedAtEnd: boolean;
}

export interface Game {
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  state: 'lobby' | 'playing' | 'ended';
  gameMode: GameMode;
  blitz: Blitz;
  defenceDice: DefenceDice;
  cards: CardsMode;
  turnDuration: TurnDuration;
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  troopsToDeploy: number;
  turnStartedAt: number;
  paused: boolean;
  pausedAt: number | null;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  playerIds: number[];
  spectatorIds: number[];
  playerTeams: Map<number, number>;
  playerColors: Map<number, number>;
  bannedIds: Set<number>;
  territoryOwners: Map<number, number>;
  territoryTroops: Map<number, number>;
  capitalTerritoryIds: Set<number>;
  hostPriority: number[];
  surrenderedIds: Set<number>;
  winnerIds: number[];
  deck: Card[];
  playerCards: Map<number, Card[]>;
  conqueredThisTurn: boolean;
  cardSetsPlayed: number;
  cardsLastSetValue: number;
  stats: Map<number, PlayerStats>;
  deathOrder: number[];
  teamDeathOrder: number[];
  finalRanking: number[];
  replayInitial: ReplayTerritory[];
  replayFrames: ReplayFrame[];
  connectivitySnapshotTaken: boolean;
}
