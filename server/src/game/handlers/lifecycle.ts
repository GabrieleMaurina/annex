import { Engine, fromClient, viewResponse } from 'engine';
import { Server, Socket } from 'socket.io';
import {
  emitBlockedPlayers,
  loadBlockPeers,
  peerGames,
} from '../../conduct/blockPeers';
import { rememberReportableGame } from '../../conduct/reports';
import { recordGameParticipants } from '../../elo';
import {
  applyMetaUpdate,
  checkGamePassword,
  createGameMeta,
  emitGameMeta,
  grantGamePasswordExempt,
  parseMetaSettings,
} from '../../gameMeta';
import {
  gameNameByPlayerId,
  playerIdBySocketId,
  setSocketRoom,
  userIdBySocketId,
} from '../../sockets/socketRooms';
import { isObject } from '../../validate';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

function settingsFromClient(
  playerId: number,
  settings: Record<string, unknown>,
): Record<string, unknown> | null {
  const { bannedPlayerIds, teams } = settings;
  const bannedIds = Array.isArray(bannedPlayerIds)
    ? bannedPlayerIds.map((id) => fromClient(playerId, id))
    : bannedPlayerIds;
  if (Array.isArray(bannedIds) && bannedIds.includes(undefined)) return null;
  return {
    ...settings,
    bannedPlayerIds: bannedIds,
    teams: Array.isArray(teams)
      ? teams.map((team) =>
          isObject(team) && Array.isArray(team.playerIds)
            ? {
                ...team,
                playerIds: team.playerIds.map((id) => fromClient(playerId, id)),
              }
            : team,
        )
      : teams,
  };
}

export function registerGameHandlers(
  io: Server,
  socket: Socket,
  engine: Engine,
) {
  socket.on(
    'game:create',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not identified' });
      const response = engine.createGame(playerId, isObject(data) ? data : {});
      if (response.ok) {
        createGameMeta(response.game.name, playerId);
        setSocketRoom(io, playerId, response.game.name);
        emitGameMeta(io, response.game.name, socket);
      }
      callback(viewResponse(playerId, response));
    },
  );

  socket.on(
    'game:join',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not identified' });

      const gameName = isObject(data) ? data.gameName : undefined;
      if (typeof gameName !== 'string')
        return callback({ ok: false, error: 'game not found' });
      const password = isObject(data) ? data.password : undefined;

      if (!checkGamePassword(gameName, playerId, password))
        return callback({ ok: false, error: 'invalid password' });

      const join = () => {
        const response = engine.joinGame(playerId, gameName);
        if (response.ok) {
          grantGamePasswordExempt(response.game.name, playerId);
          setSocketRoom(io, playerId, response.game.name);
          emitGameMeta(io, response.game.name, socket);
        }
        callback(viewResponse(playerId, response));
        if (response.ok) emitBlockedPlayers(io, playerId);
      };

      const userId = userIdBySocketId.get(socket.id);
      if (!userId || engine.isGameMember(playerId, gameName)) return join();
      loadBlockPeers(userId)
        .then(() => {
          if (playerIdBySocketId.get(socket.id) !== playerId) return;
          if (peerGames(userId).has(gameName))
            callback({ ok: false, error: 'game unavailable' });
          else join();
        })
        .catch(() => callback({ ok: false, error: 'server error' }));
    },
  );

  socket.on('game:requestState', () => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    engine.requestState(playerId);
    const gameName = gameNameByPlayerId.get(playerId);
    if (gameName) emitGameMeta(io, gameName, socket);
  });

  socket.on('game:requestResults', () => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    engine.requestResults(playerId);
  });

  socket.on(
    'game:settings',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });

      const settings = settingsFromClient(playerId, isObject(data) ? data : {});
      if (!settings)
        return callback({ ok: false, error: 'invalid banned players' });
      const metaUpdate = parseMetaSettings(settings);
      if ('error' in metaUpdate)
        return callback({ ok: false, error: metaUpdate.error });

      const response = engine.updateSettings(playerId, settings);
      if (response.ok && Object.keys(metaUpdate).length > 0) {
        applyMetaUpdate(response.game.name, metaUpdate);
        emitGameMeta(io, response.game.name);
      }
      callback(viewResponse(playerId, response));
    },
  );

  socket.on('game:start', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    const response = engine.startGame(playerId);
    if (response.ok) {
      const started = response.game as {
        name: string;
        players: { id: number }[];
      };
      recordGameParticipants(started);
      rememberReportableGame(started);
    }
    callback(viewResponse(playerId, response));
    if (!response.ok) return;
    for (const [viewerId, name] of gameNameByPlayerId)
      if (name === response.game.name) emitBlockedPlayers(io, viewerId);
  });

  socket.on('game:cycleColor', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(viewResponse(playerId, engine.cycleColor(playerId)));
  });

  socket.on('game:nextPhase', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(viewResponse(playerId, engine.nextPhase(playerId)));
  });

  socket.on('game:pause', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(viewResponse(playerId, engine.pauseGame(playerId)));
  });

  socket.on(
    'game:cycleBotSpeed',
    (callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      callback(viewResponse(playerId, engine.cycleBotSpeed(playerId)));
    },
  );

  socket.on('game:surrender', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(viewResponse(playerId, engine.surrender(playerId)));
  });

  socket.on('game:endGame', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(viewResponse(playerId, engine.endGame(playerId)));
  });

  socket.on('game:toggleDraw', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(viewResponse(playerId, engine.toggleDraw(playerId)));
  });

  socket.on(
    'game:toggleAbort',
    (callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      callback(viewResponse(playerId, engine.toggleAbort(playerId)));
    },
  );

  socket.on('game:chat', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    const message = isObject(data) ? data.message : undefined;
    if (typeof message !== 'string') return;
    engine.sendChat(playerId, message);
  });
}
