import { Engine, fromClient, isActorAnonymous } from 'engine';
import { Server, Socket } from 'socket.io';
import {
  blockUser,
  emitBlockedPlayers,
  unblockUser,
} from '../../conduct/blockPeers';
import { fileLiveGameReport, ReportResult } from '../../conduct/reports';
import { getUserBio, getUserPicture, pictureDataUrl } from '../../db';
import {
  playerIdBySocketId,
  userIdByPlayerId,
  userIdBySocketId,
} from '../../sockets/socketRooms';
import { isInteger, isObject } from '../../validate';

type Target =
  | { ok: true; actorId: number; actorUserId: string; targetUserId: string }
  | { ok: false; error: string };

type ProfileResult =
  | { ok: true; picture: string | null; bio: string }
  | { ok: false; error: string };

function resolveTarget(engine: Engine, socket: Socket, data: unknown): Target {
  const actorId = playerIdBySocketId.get(socket.id);
  const actorUserId = userIdBySocketId.get(socket.id);
  if (actorId === undefined || actorUserId === undefined)
    return { ok: false, error: 'not logged in' };
  if (isActorAnonymous(actorId)) return { ok: false, error: 'anonymous game' };
  const targetId = fromClient(actorId, isObject(data) ? data.playerId : null);
  const gameName = engine.playerGameName(actorId);
  if (
    !gameName ||
    !isInteger(targetId) ||
    !engine.isGameMember(targetId, gameName)
  )
    return { ok: false, error: 'not in this game' };
  if (targetId === actorId)
    return { ok: false, error: 'cannot block yourself' };
  const targetUserId = userIdByPlayerId(targetId);
  if (targetUserId === undefined) return { ok: false, error: 'not an account' };
  return { ok: true, actorId, actorUserId, targetUserId };
}

function registerConductAction(
  io: Server,
  socket: Socket,
  engine: Engine,
  event: string,
  action: (blockerId: string, blockedId: string) => Promise<ReportResult>,
) {
  socket.on(
    event,
    (data: unknown, callback: (response: ReportResult) => void) => {
      if (typeof callback !== 'function') return;
      const target = resolveTarget(engine, socket, data);
      if (!target.ok) return callback(target);
      action(target.actorUserId, target.targetUserId)
        .then((result) => {
          callback(result);
          if (result.ok) emitBlockedPlayers(io, target.actorId);
        })
        .catch(() => callback({ ok: false, error: 'server error' }));
    },
  );
}

export function registerConductHandlers(
  io: Server,
  socket: Socket,
  engine: Engine,
) {
  registerConductAction(io, socket, engine, 'game:block', blockUser);
  registerConductAction(io, socket, engine, 'game:unblock', unblockUser);
  socket.on(
    'game:report',
    (data: unknown, callback: (response: ReportResult) => void) => {
      if (typeof callback !== 'function') return;
      const actorId = playerIdBySocketId.get(socket.id);
      const actorUserId = userIdBySocketId.get(socket.id);
      if (actorId === undefined || actorUserId === undefined)
        return callback({ ok: false, error: 'not logged in' });
      const body = isObject(data) ? data : {};
      fileLiveGameReport(
        engine.playerGameState(actorId) === 'lobby'
          ? null
          : engine.playerGameName(actorId),
        actorUserId,
        fromClient(actorId, body.playerId),
        body.reason,
        isActorAnonymous(actorId),
      )
        .then(callback)
        .catch(() => callback({ ok: false, error: 'server error' }));
    },
  );
  socket.on(
    'game:profile',
    (data: unknown, callback: (response: ProfileResult) => void) => {
      if (typeof callback !== 'function') return;
      const actorId = playerIdBySocketId.get(socket.id);
      if (actorId === undefined)
        return callback({ ok: false, error: 'not in this game' });
      if (isActorAnonymous(actorId))
        return callback({ ok: true, picture: null, bio: '' });
      const targetId = fromClient(
        actorId,
        isObject(data) ? data.playerId : null,
      );
      const gameName = engine.playerGameName(actorId);
      if (
        !gameName ||
        !isInteger(targetId) ||
        !engine.isGameMember(targetId, gameName)
      )
        return callback({ ok: false, error: 'not in this game' });
      const userId = userIdByPlayerId(targetId);
      if (userId === undefined)
        return callback({ ok: true, picture: null, bio: '' });
      Promise.all([getUserPicture(userId), getUserBio(userId)])
        .then(([picture, bio]) =>
          callback({
            ok: true,
            picture: pictureDataUrl(picture),
            bio,
          }),
        )
        .catch(() => callback({ ok: false, error: 'server error' }));
    },
  );
}
