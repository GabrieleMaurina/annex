export interface Player {
  key: string;
  name: string;
}

export interface GameSummary {
  name: string;
  mapName: string;
  playerCount: number;
  slots: number;
  state: 'lobby' | 'playing';
  spectatorCount: number;
}

export type DiceRandomness = 'Balanced' | 'True';
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
  diceRandomness?: DiceRandomness;
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
