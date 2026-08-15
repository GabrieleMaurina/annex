import { Server, Socket } from 'socket.io';
import { gameRoomName, leaveGame, listGameSummaries } from './game';
import { HOME_ROOM, Player } from './types';

export function registerHomeHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<string, Player>,
) {
  socket.on(
    'player:identify',
    ({
      playerId,
      playerName,
      room,
    }: {
      playerId: string;
      playerName: string;
      room: string;
    }) => {
      let player = playersById.get(playerId);
      if (player) {
        if (player.socketId !== socket.id) {
          playersBySocket.delete(player.socketId);
          io.sockets.sockets.get(player.socketId)?.disconnect(true);
        }
        player.name = playerName;
        player.socketId = socket.id;
      } else {
        player = {
          id: playerId,
          name: playerName,
          socketId: socket.id,
          gameName: null,
        };
        playersById.set(playerId, player);
      }
      playersBySocket.set(socket.id, player);

      if (room !== player.gameName) leaveGame(player);

      for (const joinedRoom of [...socket.rooms]) {
        if (joinedRoom !== socket.id) socket.leave(joinedRoom);
      }
      socket.join(player.gameName ? gameRoomName(player.gameName) : HOME_ROOM);
    },
  );

  socket.on('player:setName', ({ name }: { name: string }) => {
    const player = playersBySocket.get(socket.id);
    if (!player) return;
    player.name = name;
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
