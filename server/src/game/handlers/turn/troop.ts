import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerTroopHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:placeTroop', (playerId, data) =>
    engine.placeTroop(playerId, data.territoryId, data.troops),
  );
}
