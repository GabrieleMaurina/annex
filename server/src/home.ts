import { Server, Socket } from 'socket.io';
import { gameRoomName, leaveGame, listGameSummaries } from './game';
import { HOME_ROOM, Player } from './types';

let nextPlayerId = 1;

const MAX_PLAYER_NAME_LENGTH = 10;

function isValidName(name: string): boolean {
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
    (
      {
        playerKey,
        playerName,
        room,
      }: {
        playerKey: string;
        playerName: string;
        room: string;
      },
      callback: (response: { id: number }) => void,
    ) => {
      let player = playersByKey.get(playerKey);
      if (player) {
        if (player.socketId !== socket.id) {
          playersBySocket.delete(player.socketId);
          io.sockets.sockets.get(player.socketId)?.disconnect(true);
        }
        player.socketId = socket.id;
      } else {
        player = {
          key: playerKey,
          id: nextPlayerId++,
          name: isValidName(playerName) ? playerName.trim() : 'Player',
          socketId: socket.id,
          gameName: null,
        };
        playersByKey.set(playerKey, player);
        playersById.set(player.id, player);
      }
      playersBySocket.set(socket.id, player);

      if (room !== player.gameName) leaveGame(player);

      for (const joinedRoom of [...socket.rooms]) {
        if (joinedRoom !== socket.id) socket.leave(joinedRoom);
      }
      socket.join(player.gameName ? gameRoomName(player.gameName) : HOME_ROOM);

      callback({ id: player.id });
    },
  );

  socket.on('player:setName', ({ name }: { name: string }) => {
    const player = playersBySocket.get(socket.id);
    if (!player || !isValidName(name)) return;
    player.name = name.trim();
  });

  socket.on('disconnect', () => {
    const player = playersBySocket.get(socket.id);
    playersBySocket.delete(socket.id);
    if (player) leaveGame(player);
  });
}

export function broadcastHomeGames(io: Server) {
  io.to(HOME_ROOM).emit('home:games', listGameSummaries());
}
