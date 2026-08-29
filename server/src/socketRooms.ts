import { Server } from 'socket.io';
import { gameRoomName } from './rooms';

export const HOME_ROOM = 'home';

export const socketIdByPlayerId = new Map<number, string>();
export const playerIdBySocketId = new Map<string, number>();

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
  const socketId = socketIdByPlayerId.get(playerId);
  if (!socketId) return;
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) return;
  for (const joinedRoom of [...socket.rooms]) {
    if (joinedRoom !== socket.id) socket.leave(joinedRoom);
  }
  socket.join(gameName ? gameRoomName(gameName) : HOME_ROOM);
}
