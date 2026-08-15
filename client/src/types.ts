export interface Player {
  key: string;
  name: string;
}

export interface GameSummary {
  name: string;
  mapName: string;
  playerCount: number;
  slots: number;
}

export interface GameState {
  name: string;
  mapName: string;
  slots: number;
  hostId: number;
  players: { id: number; name: string }[];
  bannedPlayers: { id: number; name: string }[];
}

export interface GameSettingsInput {
  name?: string;
  mapName?: string;
  slots?: number;
  bannedPlayerIds?: number[];
}

export type Ack = { ok: true; game: GameState } | { ok: false; error: string };
