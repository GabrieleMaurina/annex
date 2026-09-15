import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../../handlerHelpers';

export function registerSailHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:sailSelectStart', (playerId, data) =>
    engine.sailSelectStart(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:sailSelectEnd', (playerId, data) =>
    engine.sailSelectEnd(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:sail', (playerId, data) =>
    engine.sail(playerId, data.ships),
  );
}
