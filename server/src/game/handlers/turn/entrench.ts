import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerEntrenchHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:entrench', (playerId, data) =>
    engine.entrench(playerId, data.territoryId, data.troops),
  );
}
