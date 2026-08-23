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
export type CardsMode =
  | 'Constant'
  | 'Linear'
  | 'Exponential'
  | 'Linear Per Player'
  | 'Exponential Per Player';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode =
  | 'Supremacy'
  | 'Supremacy 3/4'
  | 'Supremacy 2/3'
  | 'Capitals'
  | 'Team Deathmatch'
  | '5-Turn'
  | '10-Turn'
  | 'Assassin'
  | 'Mission';
export type Placement = 'Random' | 'Semi' | 'Custom';
export type Fortification = 'Connected' | 'Neighboring' | 'Unrestricted';
export type TurnPhase =
  'territory' | 'troop' | 'capital' | 'deploy' | 'attack' | 'fortify';
export type Visibility = 'public' | 'private';

export type EmojiValue = '👍' | '👎' | '❤️' | '🙂' | '🙁' | '😲' | '🙏' | '⚔️';
export type EmojiAttackTarget =
  | { type: 'player'; playerId: number }
  | { type: 'territory'; territoryId: number };

export type Mission =
  | { type: 'territories'; fraction: number; minTroopsPerTerritory: number }
  | { type: 'continents'; continentIds: number[] }
  | { type: 'assassinate'; targetId: number };
export type MissionType = Mission['type'];

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
  placement: Placement;
  fortification: Fortification;
  turnDuration: TurnDuration;
  password: string | null;
  visibility: Visibility;
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  troopsToDeploy: number;
  remainingSpecialPhases: TurnPhase[];
  placementTroopPools: Map<number, number>;
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
  passwordExemptIds: Set<number>;
  territoryOwners: Map<number, number>;
  territoryTroops: Map<number, number>;
  capitalTerritoryIds: Set<number>;
  playerMissions: Map<number, Mission>;
  hostPriority: number[];
  surrenderedIds: Set<number>;
  winnerIds: number[];
  deck: Card[];
  playerCards: Map<number, Card[]>;
  conqueredThisTurn: boolean;
  cardSetsPlayed: Map<number, number>;
  cardsLastSetValue: Map<number, number>;
  stats: Map<number, PlayerStats>;
  deathOrder: number[];
  teamDeathOrder: number[];
  finalRanking: number[];
  replayInitial: ReplayTerritory[];
  replayFrames: ReplayFrame[];
}
