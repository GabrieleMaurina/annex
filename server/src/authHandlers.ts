import { Engine, randomPlayerName } from 'engine';
import { Server, Socket } from 'socket.io';
import {
  attachSession,
  ClientSettings,
  confirmEmail,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  destroySession,
  GameSettings,
  login,
  LoginResult,
  randomToken,
  recoverUsername,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  updateUserSettings,
} from './auth';
import { clientIp, queueSessionRotation } from './cookies';
import {
  allowAuthAttempt,
  clearLoginFailures,
  loginLockedOut,
  recordLoginFailure,
} from './rateLimit';
import {
  bindSocket,
  gameNameByPlayerId,
  HOME_ROOM,
  playerIdBySessionToken,
  playerIdBySocketId,
  playerIdByUserId,
  rebindingPlayerIds,
  sessionTokenBySocketId,
  setSocketRoom,
  socketIdByPlayerId,
  userIdBySocketId,
} from './socketRooms';
import { isObject } from './validate';

const ROTATION_GRACE_MS = 5000;

type SimpleAck = (res: { ok: true } | { ok: false; error: string }) => void;

type LoggedInAck = (
  res:
    | {
        ok: true;
        username: string;
        clientSettings: ClientSettings;
        gameSettings: GameSettings;
        gameName: string | null;
      }
    | { ok: false; error: string },
) => void;

export function registerAuthHandlers(
  io: Server,
  socket: Socket,
  engine: Engine,
) {
  function completeLogin(
    res: Extract<LoginResult, { ok: true }>,
    persistent: boolean,
  ): Promise<{
    username: string;
    clientSettings: ClientSettings;
    gameSettings: GameSettings;
    gameName: string | null;
  }> {
    const playerId = playerIdBySocketId.get(socket.id);
    const currentToken = sessionTokenBySocketId.get(socket.id);
    if (playerId === undefined || currentToken === undefined)
      return Promise.reject(new Error('not identified'));

    const newToken = randomToken();
    playerIdBySessionToken.delete(currentToken);
    return attachSession(newToken, res.userId).then(() => {
      const existing = playerIdByUserId.get(res.userId);
      let effectiveId = playerId;
      if (existing !== undefined && existing !== playerId) {
        effectiveId = existing;
        engine.disconnect(playerId);
        socketIdByPlayerId.delete(playerId);
      } else {
        playerIdByUserId.set(res.userId, playerId);
      }
      rebindingPlayerIds.add(effectiveId);
      bindSocket(io, socket, effectiveId, newToken, res.userId);
      queueSessionRotation(currentToken, newToken, persistent);
      setTimeout(() => {
        if (!rebindingPlayerIds.delete(effectiveId)) return;
        const sid = socketIdByPlayerId.get(effectiveId);
        if (!sid || !io.sockets.sockets.get(sid)?.connected)
          engine.disconnect(effectiveId);
      }, ROTATION_GRACE_MS).unref();
      engine.setName(effectiveId, res.username);
      const room = gameNameByPlayerId.get(effectiveId) ?? HOME_ROOM;
      const result = engine.resyncPlayer(effectiveId, room);
      setSocketRoom(io, effectiveId, result.gameName);
      return {
        username: res.username,
        clientSettings: res.clientSettings,
        gameSettings: res.gameSettings,
        gameName: result.gameName,
      };
    });
  }

  function handleLoggedIn(
    result: Promise<LoginResult>,
    callback: LoggedInAck,
    persistent: boolean,
  ) {
    result
      .then((res) => {
        if (!res.ok) {
          callback(res);
          return;
        }
        return completeLogin(res, persistent).then((payload) =>
          callback({ ok: true, ...payload }),
        );
      })
      .catch((error: Error) =>
        callback({
          ok: false,
          error:
            error.message === 'not identified' ? error.message : 'server error',
        }),
      );
  }

  const ip = clientIp(socket.handshake.headers, socket.handshake.address);

  socket.on('auth:register', (data: unknown, callback: SimpleAck) => {
    if (typeof callback !== 'function' || !isObject(data)) return;
    if (!allowAuthAttempt(ip)) {
      callback({ ok: false, error: 'too many requests' });
      return;
    }
    registerAccount({
      username: data.username,
      email: data.email,
      password: data.password,
    })
      .then(callback)
      .catch(() => callback({ ok: false, error: 'server error' }));
  });

  socket.on('auth:confirmEmail', (data: unknown, callback: SimpleAck) => {
    if (typeof callback !== 'function' || !isObject(data)) return;
    if (!allowAuthAttempt(ip)) {
      callback({ ok: false, error: 'too many requests' });
      return;
    }
    confirmEmail(data.code)
      .then(callback)
      .catch(() => callback({ ok: false, error: 'server error' }));
  });

  socket.on('auth:resetPassword', (data: unknown, callback: LoggedInAck) => {
    if (typeof callback !== 'function' || !isObject(data)) return;
    if (!allowAuthAttempt(ip)) {
      callback({ ok: false, error: 'too many requests' });
      return;
    }
    handleLoggedIn(
      resetPassword(data.code, data.password),
      callback,
      data.stayLoggedIn !== false,
    );
  });

  socket.on('auth:login', (data: unknown, callback: LoggedInAck) => {
    if (typeof callback !== 'function' || !isObject(data)) return;
    if (!allowAuthAttempt(ip)) {
      callback({ ok: false, error: 'too many requests' });
      return;
    }
    const username = data.username;
    handleLoggedIn(
      login({ username, password: data.password }).then((res) => {
        if (typeof username !== 'string') return res;
        if (res.ok) {
          clearLoginFailures(username);
          return res;
        }
        if (res.error === 'invalid credentials') {
          recordLoginFailure(username);
          if (loginLockedOut(username))
            return { ok: false as const, error: 'too many requests' };
        }
        return res;
      }),
      callback,
      data.stayLoggedIn !== false,
    );
  });

  socket.on(
    'auth:recoverUsername',
    (data: unknown, callback: (res: { ok: true }) => void) => {
      if (typeof callback !== 'function' || !isObject(data)) return;
      if (!allowAuthAttempt(ip)) {
        callback({ ok: true });
        return;
      }
      recoverUsername(data.email)
        .then(callback)
        .catch(() => callback({ ok: true }));
    },
  );

  socket.on(
    'auth:requestPasswordReset',
    (data: unknown, callback: (res: { ok: true }) => void) => {
      if (typeof callback !== 'function' || !isObject(data)) return;
      if (!allowAuthAttempt(ip)) {
        callback({ ok: true });
        return;
      }
      requestPasswordReset(data.email)
        .then(callback)
        .catch(() => callback({ ok: true }));
    },
  );

  socket.on(
    'auth:logout',
    (
      _data: unknown,
      callback: (
        res:
          | {
              ok: true;
              name: string;
              clientSettings: ClientSettings;
              gameSettings: GameSettings;
            }
          | { ok: false; error: string },
      ) => void,
    ) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      const currentToken = sessionTokenBySocketId.get(socket.id);
      const userId = userIdBySocketId.get(socket.id);
      if (playerId === undefined || currentToken === undefined) {
        callback({ ok: false, error: 'not identified' });
        return;
      }

      engine.surrender(playerId);

      const newName = randomPlayerName();
      playerIdBySessionToken.set(currentToken, playerId);
      userIdBySocketId.delete(socket.id);
      if (userId !== undefined) playerIdByUserId.delete(userId);
      engine.setName(playerId, newName);
      engine.resyncPlayer(
        playerId,
        gameNameByPlayerId.get(playerId) ?? HOME_ROOM,
      );

      const done = () =>
        callback({
          ok: true,
          name: newName,
          clientSettings: DEFAULT_CLIENT_SETTINGS,
          gameSettings: DEFAULT_GAME_SETTINGS,
        });
      destroySession(currentToken).then(done).catch(done);
    },
  );

  socket.on('user:updateSettings', (data: unknown) => {
    if (!isObject(data)) return;
    const userId = userIdBySocketId.get(socket.id);
    if (userId === undefined) return;
    updateUserSettings(userId, {
      clientSettings: data.clientSettings,
      gameSettings: data.gameSettings,
    }).catch(() => {});
  });
}
