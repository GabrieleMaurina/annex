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
  canCreateGame,
  canJoinGame,
  gameCreated,
  gameJoined,
  hasInvitesFor,
  isInvitedTo,
  renameError,
} from '../../invites/invites';
import {
  gameNameByPlayerId,
  playerIdBySocketId,
  setSocketRoom,
  userIdBySocketId,
} from '../../sockets/socketRooms';
import { isObject } from '../../validate';
import { registerGameAction } from '../handlerHelpers';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

function settingsFromClient(
  playerId: number,
  settings: Record<string, unknown>,
): Record<string, unknown> | null {
  const { bannedPlayerIds, teams, playerOdds } = settings;
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
    playerOdds: Array.isArray(playerOdds)
      ? playerOdds.map((entry) =>
          isObject(entry)
            ? { ...entry, playerId: fromClient(playerId, entry.playerId) }
            : entry,
        )
      : playerOdds,
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
      const userId = userIdBySocketId.get(socket.id);
      const name = isObject(data) ? data.name : undefined;
      if (typeof name === 'string' && !canCreateGame(name.trim(), userId))
        return callback({ ok: false, error: 'game name already in use' });
      const response = engine.createGame(playerId, isObject(data) ? data : {});
      if (response.ok) {
        if (userId) gameCreated(response.game.name, userId);
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
      const userId = userIdBySocketId.get(socket.id);

      if (!canJoinGame(gameName, userId))
        return callback({ ok: false, error: 'game unavailable' });

      if (
        !checkGamePassword(gameName, playerId, password) &&
        !(userId && isInvitedTo(gameName, userId))
      )
        return callback({ ok: false, error: 'invalid password' });

      const join = () => {
        const response = engine.joinGame(playerId, gameName);
        if (response.ok) {
          if (userId) gameJoined(response.game.name, userId);
          grantGamePasswordExempt(response.game.name, playerId);
          setSocketRoom(io, playerId, response.game.name);
          emitGameMeta(io, response.game.name, socket);
        }
        callback(viewResponse(playerId, response));
        if (response.ok) emitBlockedPlayers(io, playerId);
      };

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
      const currentName = gameNameByPlayerId.get(playerId);
      const newName =
        typeof settings.name === 'string' ? settings.name.trim() : null;
      const anonymousRename =
        settings.anonymous === 'on' &&
        engine
          .listGameSummaries()
          .some(
            (game) =>
              game.name === currentName && game.settings.anonymous === 'off',
          );
      const nameError =
        currentName && newName && newName !== currentName
          ? renameError(currentName, newName)
          : currentName && anonymousRename && hasInvitesFor(currentName)
            ? 'game has pending invites'
            : null;
      if (nameError) return callback({ ok: false, error: nameError });
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
    const started = response.ok && response.game.state === 'playing';
    if (started) {
      const startedGame = response.game as {
        name: string;
        players: { id: number }[];
      };
      recordGameParticipants(startedGame);
      rememberReportableGame(startedGame);
    }
    callback(viewResponse(playerId, response));
    if (!started) return;
    for (const [viewerId, name] of gameNameByPlayerId)
      if (name === response.game.name) emitBlockedPlayers(io, viewerId);
  });

  registerGameAction(socket, 'game:setReady', (playerId, data) =>
    engine.setReady(playerId, data.ready),
  );

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

  socket.on(
    'game:previousPhase',
    (callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      callback(viewResponse(playerId, engine.previousPhase(playerId)));
    },
  );

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
