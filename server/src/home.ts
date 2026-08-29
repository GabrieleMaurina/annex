import { Engine } from 'engine';
import { Server, Socket } from 'socket.io';
import {
  playerIdBySocketId,
  setSocketRoom,
  socketIdByPlayerId,
} from './socketRooms';
import { isObject } from './validate';

const MAX_PLAYER_NAME_LENGTH = 10;

function isValidName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_PLAYER_NAME_LENGTH;
}

export function registerHomeHandlers(
  io: Server,
  socket: Socket,
  engine: Engine,
) {
  socket.on(
    'player:identify',
    (
      data: unknown,
      callback: (response: { id: number; gameName: string | null }) => void,
    ) => {
      if (typeof callback !== 'function') return;
      if (!isObject(data)) return;
      const { playerKey, playerName, room } = data;
      if (typeof playerKey !== 'string' || typeof room !== 'string') return;

      const result = engine.identify(
        playerKey,
        isValidName(playerName) ? playerName.trim() : undefined,
        room,
      );

      const oldSocketId = socketIdByPlayerId.get(result.id);
      if (oldSocketId && oldSocketId !== socket.id) {
        playerIdBySocketId.delete(oldSocketId);
        io.sockets.sockets.get(oldSocketId)?.disconnect(true);
      }
      socketIdByPlayerId.set(result.id, socket.id);
      playerIdBySocketId.set(socket.id, result.id);

      setSocketRoom(io, result.id, result.gameName);

      callback(result);
    },
  );

  socket.on('player:setName', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    if (!isObject(data)) return;
    const { name } = data;
    if (!isValidName(name)) return;
    engine.setName(playerId, name.trim());
  });

  socket.on('disconnect', () => {
    const playerId = playerIdBySocketId.get(socket.id);
    playerIdBySocketId.delete(socket.id);
    if (playerId === undefined) return;
    if (socketIdByPlayerId.get(playerId) === socket.id)
      socketIdByPlayerId.delete(playerId);
    engine.disconnect(playerId);
  });
}
