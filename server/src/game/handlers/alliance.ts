import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../socketRooms';
import { isInteger, isObject } from '../../validate';

export function registerAllianceHandlers(socket: Socket, engine: Engine) {
  socket.on('game:offerAlliance', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    const targetPlayerId = isObject(data) ? data.targetPlayerId : undefined;
    if (!isInteger(targetPlayerId)) return;
    engine.offerAlliance(playerId, targetPlayerId);
  });

  socket.on('game:revokeAllianceRequest', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    const targetPlayerId = isObject(data) ? data.targetPlayerId : undefined;
    if (!isInteger(targetPlayerId)) return;
    engine.revokeAllianceRequest(playerId, targetPlayerId);
  });

  socket.on('game:respondAllianceRequest', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    if (!isObject(data)) return;
    const { fromPlayerId, accept } = data;
    if (!isInteger(fromPlayerId) || typeof accept !== 'boolean') return;
    engine.respondAllianceRequest(playerId, fromPlayerId, accept);
  });

  socket.on('game:terminateAlliance', (data: unknown) => {
    const playerId = playerIdBySocketId.get(socket.id);
    if (playerId === undefined) return;
    const targetPlayerId = isObject(data) ? data.targetPlayerId : undefined;
    if (!isInteger(targetPlayerId)) return;
    engine.terminateAlliance(playerId, targetPlayerId);
  });
}
