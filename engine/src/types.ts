import type { MapSize, WaterLevel } from './mapgen/core/params';

export const HOME_ROOM = 'home';
export const OFFLINE_ROOM = 'offline';

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

export interface GeneratedGameMap {
  territories: Territory[];
  bonuses: number[];
  displayName: string;
  imageSrc: string;
  seed: string;
  size: MapSize;
  water: WaterLevel;
}

export interface Player {
  id: number;
  name: string;
  gameName: string | null;
  connected: boolean;
  isBot: boolean;
  botProfile?: BotProfile;
}

export type BotDifficulty = 'idle' | 'easy' | 'medium' | 'hard';
export type BotPersonality =
  'balanced' | 'taker' | 'breaker' | 'killer' | 'vengeful' | 'erratic';

export interface BotProfile {
  difficulty: BotDifficulty;
  personality: BotPersonality;
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
  | 'Continent'
  | '5-Round'
  | '10-Round'
  | 'Assassin'
  | 'Mission'
  | 'Player Kills'
  | 'Troop Kills';
export type Placement = 'Random' | 'Semi' | 'Custom';
export type Fortification = 'Connected' | 'Neighboring' | 'Unrestricted';
export type Entrenchments = 'off' | 'on';
export type Toxins = 'off' | 'temporary' | 'permanent';
export type Portals = 'off' | 'static' | 'dynamic';
export type Radiations = 'off' | 'static' | 'dynamic' | 'expanding';
export type Starvation = 'off' | 'territory' | 'total' | 'percent';
export type RoundTroops = 'off' | 'on';
export type Bounties = 'off' | 'on';
export type SupplyLines = 'off' | 'on';
export type FogOfWar = 'off' | 'on';
export type Alliances = 'off' | 'on';
export type TurnPhase =
  | 'territory'
  | 'troop'
  | 'capital'
  | 'deploy'
  | 'attack'
  | 'fortify'
  | 'entrench'
  | 'toxins';

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
      defenderId: number | undefined;
      attackLosses: number;
      defenceLosses: number;
    }
  | { type: 'entrench'; territoryId: number; troops: number; playerId: number }
  | { type: 'starve'; territoryId: number; troops: number; playerId: number }
  | { type: 'toxins'; territoryId: number; playerId: number };

export interface ReplayTerritory {
  id: number;
  ownerId: number;
  troops: number;
  entrenchedTurns: number;
}

export interface ReplayToxinTerritory {
  id: number;
  permanent: boolean;
  roundsRemaining: number;
}

export interface ReplayFrame {
  territories: ReplayTerritory[];
  toxinTerritories: ReplayToxinTerritory[];
  radiationTerritories: number[];
  animation: ReplayAnimation;
  roundNumber: number;
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
  generatedMap: GeneratedGameMap | null;
  slots: number;
  hostId: number;
  originalHostId: number;
  offline: boolean;
  state: 'lobby' | 'playing' | 'ended';
  alliances: Alliances;
  allianceIds: Set<string>;
  allianceRequests: Map<string, AllianceRequest>;
  allianceCooldowns: Map<string, number>;
  allianceInitiators: Map<string, number>;
  blitz: Blitz;
  bounties: Bounties;
  cards: CardsMode;
  defenceDice: DefenceDice;
  disconnectBotDifficulty: BotDifficulty | 'random';
  disconnectBotPersonality: BotPersonality | 'random';
  entrenchments: Entrenchments;
  fogOfWar: FogOfWar;
  fortification: Fortification;
  gameMode: GameMode;
  continentId: number | null;
  placement: Placement;
  portals: Portals;
  portalTerritoryIds: number[];
  portalsEnabled: boolean;
  radiations: Radiations;
  radiationTerritoryIds: Set<number>;
  radiationUpcomingTerritoryIds: Set<number>;
  starvation: Starvation;
  supplyLines: SupplyLines;
  toxins: Toxins;
  turnDuration: TurnDuration;
  roundTroops: RoundTroops;
  roundNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  troopsToDeploy: number;
  remainingSpecialPhases: TurnPhase[];
  placementTroopPools: Map<number, number>;
  turnStartedAt: number;
  paused: boolean;
  pausedAt: number | null;
  humansAbandonedAt: number | null;
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
  territoryEntrenchment: Map<number, number>;
  territoryToxins: Map<number, { permanent: boolean; roundsRemaining: number }>;
  capitalTerritoryIds: Set<number>;
  playerMissions: Map<number, Mission>;
  hostPriority: number[];
  substituteFor: Map<number, number>;
  lobbyDeparted: Map<number, { team: number; color: number }>;
  surrenderedIds: Set<number>;
  winnerIds: number[];
  deck: Card[];
  playerCards: Map<number, Card[]>;
  conqueredThisTurn: boolean;
  deployCardMandate: boolean;
  cardSetsPlayed: Map<number, number>;
  cardsLastSetValue: Map<number, number>;
  stats: Map<number, PlayerStats>;
  deathOrder: number[];
  teamDeathOrder: number[];
  finalRanking: number[];
  replayInitial: ReplayTerritory[];
  replayInitialRadiation: number[];
  replayFrames: ReplayFrame[];
  logs: Map<number, GameLogEvent[]>;
}

export interface GameLogEvent {
  type: string;
  payload: unknown;
}

export interface AllianceRequest {
  fromId: number;
  toId: number;
}

export type AllianceViewState =
  'allied' | 'requestSent' | 'requestReceived' | 'none';
