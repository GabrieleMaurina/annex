export interface Player {
  key: string;
  name: string;
}

export interface GameSummary {
  name: string;
  mapName: string;
  playerCount: number;
  slots: number;
  phase: 'lobby' | 'playing';
  spectatorCount: number;
}

export type DiceRandomness = 'Balanced' | 'True';
export type CardsMode = 'Fixed' | 'Progressive' | 'Exponential';
export type TurnDuration = 60 | 90 | 120 | 150 | 180 | 300;
export type GameMode =
  'World Domination' | 'Capital Conquest' | 'Team Deathmatch';

export interface GameState {
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
  players: {
    id: number;
    name: string;
    team: number;
    color: number;
    territoryCount: number;
    troopCount: number;
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
  defenceDice?: 2 | 3;
  cards?: CardsMode;
  turnDuration?: TurnDuration;
}

export type Ack = { ok: true; game: GameState } | { ok: false; error: string };

export interface ChatMessage {
  id: number;
  name: string;
  message: string;
}
