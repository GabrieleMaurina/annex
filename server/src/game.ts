import { Server, Socket } from 'socket.io';
import { defaultMapName, maps } from './maps';
import { Game, HOME_ROOM, Player } from './types';

const games = new Map<string, Game>();

interface GameSettings {
  name?: string;
  mapName?: string;
  slots?: number;
  bannedPlayerIds?: number[];
}

type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function gameRoomName(name: string): string {
  return `game-${name}`;
}

function gameSummary(game: Game) {
  return {
    name: game.name,
    mapName: game.mapName,
    playerCount: game.playerIds.length,
    slots: game.slots,
  };
}

function toSummaries(ids: number[], playersById: Map<number, Player>) {
  return ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => !!player)
    .map((player) => ({ id: player.id, name: player.name }));
}

function gameState(game: Game, playersById: Map<number, Player>) {
  return {
    name: game.name,
    mapName: game.mapName,
    slots: game.slots,
    hostId: game.hostId,
    players: toSummaries(game.playerIds, playersById),
    bannedPlayers: toSummaries([...game.bannedIds], playersById),
  };
}

function removePlayerFromGame(game: Game, playerId: number) {
  game.playerIds = game.playerIds.filter((id) => id !== playerId);
  if (game.playerIds.length === 0) {
    games.delete(game.name);
    return;
  }
  if (game.hostId === playerId) {
    game.hostId = game.playerIds[0];
  }
}

export function leaveGame(player: Player) {
  if (!player.gameName) return;
  const game = games.get(player.gameName);
  player.gameName = null;
  if (game) removePlayerFromGame(game, player.id);
}

export function listGameSummaries() {
  return [...games.values()].map(gameSummary);
}

export function broadcastGameStates(
  io: Server,
  playersById: Map<number, Player>,
) {
  for (const game of games.values()) {
    io.to(gameRoomName(game.name)).emit(
      'game:state',
      gameState(game, playersById),
    );
  }
}

export function registerGameHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on('game:create', (callback: (response: GameResponse) => void) => {
    const player = playersBySocket.get(socket.id);
    if (!player) return callback({ ok: false, error: 'not identified' });
    if (player.gameName)
      return callback({ ok: false, error: 'already in a game' });

    const name = `Game with ${player.name}`;
    if (games.has(name))
      return callback({ ok: false, error: 'game name already in use' });

    const game: Game = {
      name,
      mapName: defaultMapName,
      slots: 2,
      hostId: player.id,
      playerIds: [player.id],
      bannedIds: new Set(),
    };
    games.set(game.name, game);
    player.gameName = game.name;

    socket.leave(HOME_ROOM);
    socket.join(gameRoomName(game.name));
    callback({ ok: true, game: gameState(game, playersById) });
  });

  socket.on(
    'game:join',
    (
      { gameName }: { gameName: string },
      callback: (response: GameResponse) => void,
    ) => {
      const player = playersBySocket.get(socket.id);
      if (!player) return callback({ ok: false, error: 'not identified' });
      if (player.gameName)
        return callback({ ok: false, error: 'already in a game' });

      const game = games.get(gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.bannedIds.has(player.id))
        return callback({ ok: false, error: 'banned from this game' });
      if (game.playerIds.length >= game.slots)
        return callback({ ok: false, error: 'game is full' });

      game.playerIds.push(player.id);
      player.gameName = game.name;

      socket.leave(HOME_ROOM);
      socket.join(gameRoomName(game.name));
      callback({ ok: true, game: gameState(game, playersById) });
    },
  );

  socket.on(
    'game:settings',
    (settings: GameSettings, callback: (response: GameResponse) => void) => {
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.hostId !== player.id)
        return callback({ ok: false, error: 'not the host' });

      if (settings.mapName !== undefined) {
        if (!maps.has(settings.mapName))
          return callback({ ok: false, error: 'invalid map' });
        game.mapName = settings.mapName;
      }

      if (settings.name !== undefined) {
        const trimmedName = settings.name.trim();
        if (!trimmedName) return callback({ ok: false, error: 'invalid name' });

        if (trimmedName !== game.name) {
          if (games.has(trimmedName))
            return callback({ ok: false, error: 'game name already in use' });

          const oldRoom = gameRoomName(game.name);
          const newRoom = gameRoomName(trimmedName);
          games.delete(game.name);
          for (const id of game.playerIds) {
            const member = playersById.get(id);
            if (member) member.gameName = trimmedName;
            const memberSocket =
              member && io.sockets.sockets.get(member.socketId);
            memberSocket?.leave(oldRoom);
            memberSocket?.join(newRoom);
          }
          game.name = trimmedName;
          games.set(game.name, game);
        }
      }

      if (settings.bannedPlayerIds !== undefined) {
        const newBannedIds = new Set(
          settings.bannedPlayerIds.filter((id) => id !== player.id),
        );

        for (const id of newBannedIds) {
          if (game.bannedIds.has(id) || !game.playerIds.includes(id)) {
            continue;
          }
          const kicked = playersById.get(id);
          if (!kicked) continue;
          kicked.gameName = null;
          const kickedSocket = io.sockets.sockets.get(kicked.socketId);
          kickedSocket?.leave(gameRoomName(game.name));
          kickedSocket?.join(HOME_ROOM);
          kickedSocket?.emit('game:kicked', { gameName: game.name });
          removePlayerFromGame(game, id);
        }

        game.bannedIds = newBannedIds;
      }

      if (settings.slots !== undefined) {
        if (
          !Number.isFinite(settings.slots) ||
          settings.slots < game.playerIds.length ||
          settings.slots > 20
        ) {
          return callback({ ok: false, error: 'invalid slots' });
        }
        game.slots = settings.slots;
      }

      callback({ ok: true, game: gameState(game, playersById) });
    },
  );
}
