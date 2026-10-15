import { Engine, fromClient } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../../handlerHelpers';

export function registerAttackSeaHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:attackSeaSelectStart', (playerId, data) =>
    engine.attackSeaSelectStart(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:attackSeaSelectDefender', (playerId, data) =>
    engine.attackSeaSelectDefender(
      playerId,
      fromClient(playerId, data.defenderId),
    ),
  );

  registerGameAction(socket, 'game:attackSea', (playerId, data) =>
    engine.attackSea(playerId, data.type, data.ships),
  );

  registerGameAction(socket, 'game:quickAttackSea', (playerId, data) =>
    engine.quickAttackSea(playerId, data.territoryId),
  );
}
