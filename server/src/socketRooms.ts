import { Server } from 'socket.io';
import { renameGameMeta } from './gameMeta';
import { gameRoomName } from './rooms';

export const HOME_ROOM = 'home';
export const OFFLINE_ROOM = 'offline';

export const playerIdByKey = new Map<string, number>();
export const socketIdByPlayerId = new Map<number, string>();
export const playerIdBySocketId = new Map<string, number>();
export const gameNameByPlayerId = new Map<number, string | null>();
export const offlineClientPlayerIds = new Set<number>();

export function emitTo(
  io: Server,
  playerId: number,
  event: string,
  payload?: unknown,
) {
  const socketId = socketIdByPlayerId.get(playerId);
  if (!socketId) return;
  if (payload === undefined) io.to(socketId).emit(event);
  else io.to(socketId).emit(event, payload);
}

export function setSocketRoom(
  io: Server,
  playerId: number,
  gameName: string | null,
) {
  const previousGameName = gameNameByPlayerId.get(playerId);
  gameNameByPlayerId.set(playerId, gameName);
  if (previousGameName && gameName && previousGameName !== gameName)
    renameGameMeta(previousGameName, gameName);
  const socketId = socketIdByPlayerId.get(playerId);
  if (!socketId) return;
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) return;
  for (const joinedRoom of [...socket.rooms]) {
    if (joinedRoom !== socket.id) socket.leave(joinedRoom);
  }
  socket.join(gameName ? gameRoomName(gameName) : HOME_ROOM);
}
