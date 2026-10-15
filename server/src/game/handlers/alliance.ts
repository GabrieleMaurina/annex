import { Engine, fromClient } from 'engine';
import { Socket } from 'socket.io';
import { isInteger } from '../../validate';
import { registerGameEvent } from '../handlerHelpers';

export function registerAllianceHandlers(socket: Socket, engine: Engine) {
  registerGameEvent(socket, 'game:offerAlliance', (playerId, data) => {
    const targetPlayerId = fromClient(playerId, data.targetPlayerId);
    if (!isInteger(targetPlayerId)) return;
    engine.offerAlliance(playerId, targetPlayerId);
  });

  registerGameEvent(socket, 'game:revokeAllianceRequest', (playerId, data) => {
    const targetPlayerId = fromClient(playerId, data.targetPlayerId);
    if (!isInteger(targetPlayerId)) return;
    engine.revokeAllianceRequest(playerId, targetPlayerId);
  });

  registerGameEvent(socket, 'game:respondAllianceRequest', (playerId, data) => {
    const fromPlayerId = fromClient(playerId, data.fromPlayerId);
    const { accept } = data;
    if (!isInteger(fromPlayerId) || typeof accept !== 'boolean') return;
    engine.respondAllianceRequest(playerId, fromPlayerId, accept);
  });

  registerGameEvent(socket, 'game:terminateAlliance', (playerId, data) => {
    const targetPlayerId = fromClient(playerId, data.targetPlayerId);
    if (!isInteger(targetPlayerId)) return;
    engine.terminateAlliance(playerId, targetPlayerId);
  });
}
