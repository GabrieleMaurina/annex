import { Server, Socket } from 'socket.io';
import {
  gameRoomName,
  handleReconnect,
  leaveGame,
  listGameSummaries,
} from './game';
import { HOME_ROOM, Player } from './types';
import { isObject } from './validate';

let nextPlayerId = 1;

const MAX_PLAYER_NAME_LENGTH = 10;

function isValidName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_PLAYER_NAME_LENGTH;
}

export function registerHomeHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersByKey: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'player:identify',
    (data: unknown, callback: (response: { id: number }) => void) => {
      if (typeof callback !== 'function') return;
      if (!isObject(data)) return;
      const { playerKey, playerName, room } = data;
      if (typeof playerKey !== 'string' || typeof room !== 'string') return;

      let player = playersByKey.get(playerKey);
      if (player) {
        if (player.socketId !== socket.id) {
          playersBySocket.delete(player.socketId);
          io.sockets.sockets.get(player.socketId)?.disconnect(true);
        }
        player.socketId = socket.id;
        player.connected = true;
      } else {
        player = {
          key: playerKey,
          id: nextPlayerId++,
          name: isValidName(playerName) ? playerName.trim() : 'Player',
          socketId: socket.id,
          gameName: null,
          connected: true,
        };
        playersByKey.set(playerKey, player);
        playersById.set(player.id, player);
      }
      playersBySocket.set(socket.id, player);

      if (room !== (player.gameName ?? HOME_ROOM))
        leaveGame(player, playersById, io);
      handleReconnect(player, playersById);

      for (const joinedRoom of [...socket.rooms]) {
        if (joinedRoom !== socket.id) socket.leave(joinedRoom);
      }
      socket.join(player.gameName ? gameRoomName(player.gameName) : HOME_ROOM);

      callback({ id: player.id });
    },
  );

  socket.on('player:setName', (data: unknown) => {
    const player = playersBySocket.get(socket.id);
    if (!player) return;
    if (!isObject(data)) return;
    const { name } = data;
    if (!isValidName(name)) return;
    player.name = name.trim();
  });

  socket.on('disconnect', () => {
    const player = playersBySocket.get(socket.id);
    playersBySocket.delete(socket.id);
    if (player) {
      player.connected = false;
      leaveGame(player, playersById, io);
    }
  });
}

export function broadcastHomeGames(io: Server) {
  io.to(HOME_ROOM).emit('home:games', listGameSummaries());
}
