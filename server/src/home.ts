import { Engine } from 'engine';
import { Server, Socket } from 'socket.io';
import { anonNameFor } from './auth/anonName';
import { randomToken, resolveSession } from './auth/auth';
import { sessionTokenFromRequest } from './auth/cookies';
import { emitBlockedPlayers } from './conduct/blockPeers';
import { cachedReputation } from './conduct/viewerCache';
import { countGamesPlayed } from './db';
import { emitGameMeta } from './gameMeta';
import {
  bindSocket,
  playerIdBySessionToken,
  playerIdBySocketId,
  playerIdByUserId,
  sessionTokenBySocketId,
  setPlayerIdForUser,
  setSocketRoom,
  socketIdByPlayerId,
  userIdBySocketId,
} from './sockets/socketRooms';
import { isObject } from './validate';

interface Identity {
  playerId: number;
  token: string;
  userId: string | null;
}

function resolveIdentity(engine: Engine, rawToken: string): Promise<Identity> {
  const token = rawToken || randomToken();
  const anon = (): Identity => {
    const playerId = engine.addPlayer(anonNameFor(token)).id;
    playerIdBySessionToken.set(token, playerId);
    return { playerId, token, userId: null };
  };

  return resolveSession(token).then((session) => {
    if (session) {
      let playerId = playerIdByUserId.get(session.userId);
      if (playerId === undefined) {
        playerId = engine.addPlayer(
          session.username,
          session.country,
          session.elo,
        ).id;
        setPlayerIdForUser(session.userId, playerId);
      } else {
        engine.setName(playerId, session.username);
        engine.setBadges(playerId, session.country, session.elo);
      }
      const accountPlayerId = playerId;
      return countGamesPlayed(session.userId).then((gamesPlayed) => {
        engine.setExperience(accountPlayerId, gamesPlayed, session.createdAt);
        const { reputation, recoveryFrom } = cachedReputation(
          session.userId,
        ) ?? {
          reputation: session.reputation,
          recoveryFrom: session.reputationRecoveryFrom,
        };
        engine.setReputation(accountPlayerId, reputation, recoveryFrom);
        return { playerId: accountPlayerId, token, userId: session.userId };
      });
    }
    const anonPlayerId = playerIdBySessionToken.get(token);
    if (anonPlayerId !== undefined) {
      return { playerId: anonPlayerId, token, userId: null };
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
      }) => void,
    ) => {
      if (typeof callback !== 'function') return;
      if (!isObject(data)) return;
      const { room } = data;
      if (typeof room !== 'string') return;

      const rawToken = sessionTokenFromRequest(socket.request);
      resolveIdentity(engine, rawToken).then((identity) => {
        bindSocket(
          io,
          socket,
          identity.playerId,
          identity.token,
          identity.userId,
        );

        const result = engine.resyncPlayer(identity.playerId, room);
        setSocketRoom(io, identity.playerId, result.gameName);
        if (result.gameName) {
          emitGameMeta(io, result.gameName, socket);
          emitBlockedPlayers(io, identity.playerId);
        }

        callback({
          id: result.id,
          gameName: result.gameName,
          name: result.name,
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
    if (socketIdByPlayerId.get(playerId) === socket.id)
      socketIdByPlayerId.delete(playerId);
    engine.disconnect(playerId);
  });
}
