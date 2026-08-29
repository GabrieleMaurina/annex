import { Engine } from 'engine';
import { Server, Socket } from 'socket.io';
import { emitGameMeta } from './gameMeta';
import {
  HOME_ROOM,
  OFFLINE_ROOM,
  offlineClientPlayerIds,
  playerIdByKey,
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

      const offline = room === OFFLINE_ROOM;

      let playerId = playerIdByKey.get(playerKey);
      if (playerId === undefined) {
        playerId = engine.addPlayer(
          isValidName(playerName) ? playerName.trim() : undefined,
        ).id;
        playerIdByKey.set(playerKey, playerId);
      }

      const oldSocketId = socketIdByPlayerId.get(playerId);
      if (oldSocketId && oldSocketId !== socket.id) {
        playerIdBySocketId.delete(oldSocketId);
        io.sockets.sockets.get(oldSocketId)?.disconnect(true);
      }
      socketIdByPlayerId.set(playerId, socket.id);
      playerIdBySocketId.set(socket.id, playerId);

      if (offline) offlineClientPlayerIds.add(playerId);
      else offlineClientPlayerIds.delete(playerId);

      const result = engine.resyncPlayer(playerId, offline ? HOME_ROOM : room);

      if (offline) {
        setSocketRoom(io, playerId, null);
      } else {
        setSocketRoom(io, playerId, result.gameName);
        if (result.gameName) emitGameMeta(io, result.gameName, socket);
      }

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
    offlineClientPlayerIds.delete(playerId);
    if (socketIdByPlayerId.get(playerId) === socket.id)
      socketIdByPlayerId.delete(playerId);
    engine.disconnect(playerId);
  });
}
