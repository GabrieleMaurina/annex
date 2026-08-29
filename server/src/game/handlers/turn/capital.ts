import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerCapitalHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:selectCapital', (playerId, data) =>
    engine.selectCapital(playerId, data.territoryId),
  );
}
