import { Server } from 'socket.io';
import { Game, Player } from '../../../types';
import { resolveDifficulty, resolvePersonality } from './randomProfile';
import { registerBotSocket, unregisterBotSocket } from './socket';

const takeoverSocketIds = new Map<number, string>();

// Only ever called for a real human's Player object going offline mid-game
// (lobby-added bots have no reconnect path at all). Registers a fresh
// virtual-socket shim bound to this same Player so the turn dispatcher can
// treat the seat as bot-controlled until the human reconnects.
export function startTakeover(
  game: Game,
  player: Player,
  io: Server,
  playersById: Map<number, Player>,
  playersBySocket: Map<string, Player>,
): void {
  if (player.isBot) return;
  const socketId = registerBotSocket(io, playersBySocket, playersById);
  playersBySocket.set(socketId, player);
  player.socketId = socketId;
  player.isBot = true;
  player.botProfile = {
    difficulty: resolveDifficulty(game.disconnectBotDifficulty),
    personality: resolvePersonality(game.disconnectBotPersonality),
  };
  takeoverSocketIds.set(player.id, socketId);
}

export function endTakeover(player: Player): void {
  if (!player.isBot) return;
  const socketId = takeoverSocketIds.get(player.id);
  if (socketId) unregisterBotSocket(socketId);
  takeoverSocketIds.delete(player.id);
  player.isBot = false;
  player.botProfile = undefined;
}
