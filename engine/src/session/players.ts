import { BotProfile, Player } from '../types';

export const playersById = new Map<number, Player>();
export const playersByKey = new Map<string, Player>();

let nextPlayerId = 1;
let nextBotId = 1;

const MAX_PLAYER_NAME_LENGTH = 10;

export function isValidPlayerName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_PLAYER_NAME_LENGTH;
}

export function findOrCreatePlayerByKey(
  playerKey: string,
  playerName: string | undefined,
): Player {
  const existing = playersByKey.get(playerKey);
  if (existing) {
    existing.connected = true;
    return existing;
  }
  const player: Player = {
    key: playerKey,
    id: nextPlayerId++,
    name: playerName ?? 'Player',
    gameName: null,
    connected: true,
    isBot: false,
  };
  playersByKey.set(playerKey, player);
  playersById.set(player.id, player);
  return player;
}

export function createBotPlayer(name: string, botProfile: BotProfile): Player {
  const id = -nextBotId++;
  const player: Player = {
    key: `bot:${id}`,
    id,
    name,
    gameName: null,
    connected: true,
    isBot: true,
    botProfile,
  };
  playersById.set(player.id, player);
  return player;
}
