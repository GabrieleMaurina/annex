import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerDeployHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:selectTerritory', (playerId, data) =>
    engine.selectTerritory(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:deploy', (playerId, data) =>
    engine.deploy(playerId, data.territoryId, data.troops),
  );
}
