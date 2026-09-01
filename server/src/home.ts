import { Engine } from 'engine';
import { Server, Socket } from 'socket.io';
import {
  ClientSettings,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  randomToken,
  resolveSession,
} from './auth';
import { sessionTokenFromRequest } from './cookies';
import { emitGameMeta } from './gameMeta';
import {
  bindSocket,
  HOME_ROOM,
  OFFLINE_ROOM,
  offlineClientPlayerIds,
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

interface Identity {
  playerId: number;
  token: string;
  userId: string | null;
  account: { username: string } | null;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
}

function resolveIdentity(engine: Engine, rawToken: string): Promise<Identity> {
  const token = rawToken || randomToken();
  const anon = (): Identity => {
    const playerId = engine.addPlayer().id;
    playerIdBySessionToken.set(token, playerId);
    return {
      playerId,
      token,
      userId: null,
      account: null,
      clientSettings: DEFAULT_CLIENT_SETTINGS,
      gameSettings: DEFAULT_GAME_SETTINGS,
    };
  };

  return resolveSession(token).then((session) => {
    if (session) {
      let playerId = playerIdByUserId.get(session.userId);
      if (playerId === undefined) {
        playerId = engine.addPlayer(session.username).id;
        playerIdByUserId.set(session.userId, playerId);
      } else {
        engine.setName(playerId, session.username);
      }
      return {
        playerId,
        token,
        userId: session.userId,
        account: { username: session.username },
        clientSettings: session.clientSettings,
        gameSettings: session.gameSettings,
      };
    }
    const anonPlayerId = playerIdBySessionToken.get(token);
    if (anonPlayerId !== undefined) {
      return {
        playerId: anonPlayerId,
        token,
        userId: null,
        account: null,
        clientSettings: DEFAULT_CLIENT_SETTINGS,
        gameSettings: DEFAULT_GAME_SETTINGS,
      };
    }
    return anon();
  });
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
      callback: (response: {
        id: number;
        gameName: string | null;
        name: string;
        account: { username: string } | null;
        clientSettings: ClientSettings;
        gameSettings: GameSettings;
      }) => void,
    ) => {
      if (typeof callback !== 'function') return;
      if (!isObject(data)) return;
      const { room } = data;
      if (typeof room !== 'string') return;

      const rawToken = sessionTokenFromRequest(socket.request);
      resolveIdentity(engine, rawToken).then((identity) => {
        const offline = room === OFFLINE_ROOM;

        bindSocket(
          io,
          socket,
          identity.playerId,
          identity.token,
          identity.userId,
        );
        rebindingPlayerIds.delete(identity.playerId);

        if (offline) offlineClientPlayerIds.add(identity.playerId);
        else offlineClientPlayerIds.delete(identity.playerId);

        const result = engine.resyncPlayer(
          identity.playerId,
          offline ? HOME_ROOM : room,
        );

        if (offline) {
          setSocketRoom(io, identity.playerId, null);
        } else {
          setSocketRoom(io, identity.playerId, result.gameName);
          if (result.gameName) emitGameMeta(io, result.gameName, socket);
        }

        callback({
          id: result.id,
          gameName: result.gameName,
          name: result.name,
          account: identity.account,
          clientSettings: identity.clientSettings,
          gameSettings: identity.gameSettings,
        });
      });
    },
  );

  socket.on('disconnect', () => {
    const playerId = playerIdBySocketId.get(socket.id);
    playerIdBySocketId.delete(socket.id);
    sessionTokenBySocketId.delete(socket.id);
    userIdBySocketId.delete(socket.id);
    if (playerId === undefined) return;
    if (rebindingPlayerIds.has(playerId)) return;
    offlineClientPlayerIds.delete(playerId);
    if (socketIdByPlayerId.get(playerId) === socket.id)
      socketIdByPlayerId.delete(playerId);
    engine.disconnect(playerId);
  });
}
