import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerFortifyHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:fortifySelectStart', (playerId, data) =>
    engine.fortifySelectStart(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:fortifySelectEnd', (playerId, data) =>
    engine.fortifySelectEnd(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:fortify', (playerId, data) =>
    engine.fortify(playerId, data.troops),
  );
}
