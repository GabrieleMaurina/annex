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

export type Blitz = 'Balanced' | 'True';
export type DefenceDice = 2 | 3;
export type CardsMode = 'Fixed' | 'Progressive' | 'Exponential';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode =
  'World Domination' | 'Capital Conquest' | 'Team Deathmatch';
export type TurnPhase = 'deploy' | 'attack' | 'fortify';

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
  selectedTerritoryId: number | null;
  fortifyStartTerritoryId: number | null;
  fortifyEndTerritoryId: number | null;
  attackStartTerritoryId: number | null;
  attackEndTerritoryId: number | null;
  attackConquestMinTroops: number | null;
  winnerIds: number[];
  players: {
    id: number;
    name: string;
    team: number;
    color: number;
    territoryCount: number;
    troopCount: number;
    connected: boolean;
    surrendered: boolean;
  }[];
  spectators: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
  territories: { id: number; ownerId: number; troops: number }[];
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
