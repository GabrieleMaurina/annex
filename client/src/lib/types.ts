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
export type CardsMode = 'Constant' | 'Linear' | 'Exponential';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode = 'Supremacy' | 'Capitals' | 'Team Deathmatch';
export type TurnPhase = 'capital' | 'deploy' | 'attack' | 'fortify';

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
    cardCount: number;
    connected: boolean;
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
  turnDuration?: TurnDuration;
}

export type Ack = { ok: true; game: GameState } | { ok: false; error: string };

export interface ChatMessage {
  id: number;
  name: string;
  message: string;
}
