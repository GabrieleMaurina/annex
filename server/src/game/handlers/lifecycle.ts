import { Engine } from 'engine';
import { Server, Socket } from 'socket.io';
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
} from '../../socketRooms';
import { isObject } from '../../validate';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

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
      callback(response);
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

      const response = engine.joinGame(playerId, gameName);
      if (response.ok) {
        grantGamePasswordExempt(response.game.name, playerId);
        setSocketRoom(io, playerId, response.game.name);
        emitGameMeta(io, response.game.name, socket);
      }
      callback(response);
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

      const settings = isObject(data) ? data : {};
      const metaUpdate = parseMetaSettings(settings);
      if ('error' in metaUpdate)
        return callback({ ok: false, error: metaUpdate.error });

      const response = engine.updateSettings(playerId, settings);
      if (response.ok && Object.keys(metaUpdate).length > 0) {
        applyMetaUpdate(response.game.name, metaUpdate);
        emitGameMeta(io, response.game.name);
      }
      callback(response);
    },
  );

  socket.on('game:start', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(engine.startGame(playerId));
  });

  socket.on('game:cycleColor', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(engine.cycleColor(playerId));
  });

  socket.on('game:nextPhase', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(engine.nextPhase(playerId));
  });

  socket.on('game:pause', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(engine.pauseGame(playerId));
  });

  socket.on('game:surrender', (callback: (response: GameResponse) => void) => {
    if (typeof callback !== 'function') return;
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined)
      return callback({ ok: false, error: 'not in a game' });
    callback(engine.surrender(playerId));
  });

  socket.on('game:chat', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    const message = isObject(data) ? data.message : undefined;
    if (typeof message !== 'string') return;
    engine.sendChat(playerId, message);
  });
}
