export interface Player {
  key: string;
  name: string;
}

export interface GameSummary {
  name: string;
  mapName: string;
  playerCount: number;
  slots: number;
  state: 'lobby' | 'playing' | 'ended';
  spectatorCount: number;
}

export type CardSymbol = 'soldier' | 'humvee' | 'tank';
export type SetKind = CardSymbol | 'mixed';

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

export type EmojiValue = '👍' | '👎' | '❤️' | '🙂' | '🙁' | '⚔️';
export type EmojiAttackTarget =
  | { type: 'player'; playerId: number }
  | { type: 'territory'; territoryId: number };
export interface EmojiSentPayload {
  senderId: number;
  targetPlayerId: number;
  emoji: EmojiValue;
  attackTarget?: EmojiAttackTarget;
}

export type Mission =
  | { type: 'territories'; fraction: number; minTroopsPerTerritory: number }
  | { type: 'continents'; continentIds: number[] }
  | { type: 'assassinate'; targetId: number };

export interface GameState {
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
  turnNumber: number;
  turnPlayerIndex: number;
  turnPhase: TurnPhase;
  troopsToDeploy: number;
  turnStartedAt: number;
  paused: boolean;
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  winnerIds: number[];
  finalRanking: number[];
  nextSetBaseValues: Record<SetKind, number>;
  upcomingSetValues: number[];
  players: {
    id: number;
    name: string;
    team: number;
    color: number;
    territoryCount: number;
    troopCount: number;
    capitalCount: number;
    troopsRemaining: number;
    cardCount: number;
    connected: boolean;
    connectedAtEnd: boolean;
    surrendered: boolean;
    eliminated: boolean;
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
  }[];
  spectators: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
  territories: {
    id: number;
    ownerId: number;
    troops: number;
    isCapital: boolean;
  }[];
}

export interface GameSettingsInput {
  name?: string;
  mapName?: string;
  slots?: number;
  bannedPlayerIds?: number[];
  playerTeam?: { playerId: number; team: number };
  gameMode?: GameMode;
  blitz?: Blitz;
  defenceDice?: DefenceDice;
  cards?: CardsMode;
  placement?: Placement;
  fortification?: Fortification;
  turnDuration?: TurnDuration;
}

export type Ack = { ok: true; game: GameState } | { ok: false; error: string };

export interface ChatMessage {
  id: number;
  name: string;
  message: string;
}

export interface ReplayTerritory {
  id: number;
  ownerId: number;
  troops: number;
}

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

export interface ReplayFrame {
  territories: ReplayTerritory[];
  animation: ReplayAnimation;
  turnNumber: number;
  playerId: number;
}

export type ReplayAck =
  | { ok: true; initial: ReplayTerritory[]; frames: ReplayFrame[] }
  | { ok: false; error: string };
