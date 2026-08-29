import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerTerritoryHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:claimTerritory', (playerId, data) =>
    engine.claimTerritory(playerId, data.territoryId),
  );
}
