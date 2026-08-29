import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { isInteger } from '../../validate';
import { registerGameEvent } from '../handlerHelpers';

export function registerAllianceHandlers(socket: Socket, engine: Engine) {
  registerGameEvent(socket, 'game:offerAlliance', (playerId, data) => {
    if (!isInteger(data.targetPlayerId)) return;
    engine.offerAlliance(playerId, data.targetPlayerId);
  });

  registerGameEvent(socket, 'game:revokeAllianceRequest', (playerId, data) => {
    if (!isInteger(data.targetPlayerId)) return;
    engine.revokeAllianceRequest(playerId, data.targetPlayerId);
  });

  registerGameEvent(socket, 'game:respondAllianceRequest', (playerId, data) => {
    const { fromPlayerId, accept } = data;
    if (!isInteger(fromPlayerId) || typeof accept !== 'boolean') return;
    engine.respondAllianceRequest(playerId, fromPlayerId, accept);
  });

  registerGameEvent(socket, 'game:terminateAlliance', (playerId, data) => {
    if (!isInteger(data.targetPlayerId)) return;
    engine.terminateAlliance(playerId, data.targetPlayerId);
  });
}
