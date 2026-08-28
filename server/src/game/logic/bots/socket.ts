import { Server, Socket } from 'socket.io';
import { BotProfile, Player } from '../../../types';
import {
  registerAllianceHandlers,
  registerAttackHandlers,
  registerCapitalHandlers,
  registerCardHandlers,
  registerDeployHandlers,
  registerEntrenchHandlers,
  registerFortifyHandlers,
  registerGameHandlers,
  registerTerritoryHandlers,
  registerToxinsHandlers,
  registerTroopHandlers,
} from '../../index';

type Handler = (...args: unknown[]) => void;

interface BotSocket {
  id: string;
  on(event: string, handler: Handler): void;
}

const dispatchRegistry = new Map<string, Map<string, Handler>>();

function buildShim(socketId: string): BotSocket {
  const handlers = new Map<string, Handler>();
  dispatchRegistry.set(socketId, handlers);
  return {
    id: socketId,
    on(event, handler) {
      handlers.set(event, handler);
    },
  };
}

let nextBotSocketId = 1;

// Every registerXHandlers(io, socket, ...) call only ever does socket.on(event,
// handler) and later reads socket.id inside the closures, so this minimal shim
// is enough to reuse every real game:* handler unmodified for a bot's moves.
export function registerBotSocket(
  io: Server,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
): string {
  const socketId = `bot:${nextBotSocketId++}`;
  const shim = buildShim(socketId);
  const socket = shim as unknown as Socket;
  registerAllianceHandlers(io, socket, playersBySocket, playersById);
  registerAttackHandlers(io, socket, playersBySocket, playersById);
  registerCapitalHandlers(io, socket, playersBySocket, playersById);
  registerCardHandlers(io, socket, playersBySocket, playersById);
  registerDeployHandlers(io, socket, playersBySocket, playersById);
  registerEntrenchHandlers(io, socket, playersBySocket, playersById);
  registerFortifyHandlers(io, socket, playersBySocket, playersById);
  registerGameHandlers(io, socket, playersBySocket, playersById);
  registerTerritoryHandlers(io, socket, playersBySocket, playersById);
  registerToxinsHandlers(io, socket, playersBySocket, playersById);
  registerTroopHandlers(io, socket, playersBySocket, playersById);
  return socketId;
}

export function unregisterBotSocket(socketId: string): void {
  dispatchRegistry.delete(socketId);
}

export function dispatch(
  socketId: string,
  event: string,
  payload: unknown,
  callback: (response: { ok: boolean; error?: string }) => void = () => {},
): void {
  const handler = dispatchRegistry.get(socketId)?.get(event);
  if (!handler) return;
  // Mirrors real socket.io: a client calling socket.emit(event, callback)
  // with no data invokes the handler with just the callback as its only
  // argument. A handful of handlers (game:nextPhase, game:pause, ...) are
  // registered with that single-parameter signature, so passing payload
  // through as an extra leading argument when it's undefined would silently
  // bind the callback to the handler's data parameter instead and never run.
  if (payload === undefined) handler(callback);
  else handler(payload, callback);
}

let nextBotId = 1;

export function createBotPlayer(
  io: Server,
  playersById: Map<number, Player>,
  playersBySocket: Map<string, Player>,
  name: string,
  botProfile: BotProfile,
): Player {
  const socketId = registerBotSocket(io, playersBySocket, playersById);
  const player: Player = {
    key: socketId,
    id: -nextBotId++,
    name,
    socketId,
    gameName: null,
    connected: true,
    isBot: true,
    botProfile,
  };
  playersById.set(player.id, player);
  playersBySocket.set(socketId, player);
  return player;
}
