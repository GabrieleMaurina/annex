import { BotProfile, Player } from '../types';

export const playersById = new Map<number, Player>();

let nextPlayerId = 1;
let nextBotId = 1;

const MAX_PLAYER_NAME_LENGTH = 10;

export function isValidPlayerName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_PLAYER_NAME_LENGTH;
}

export function addPlayer(name: string | undefined): Player {
  const player: Player = {
    id: nextPlayerId++,
    name: name ?? 'Player',
    gameName: null,
    connected: true,
    isBot: false,
  };
  playersById.set(player.id, player);
  return player;
}

export function createBotPlayer(name: string, botProfile: BotProfile): Player {
  const id = -nextBotId++;
  const player: Player = {
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
