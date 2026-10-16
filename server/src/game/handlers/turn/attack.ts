import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { registerGameAction } from '../../handlerHelpers';

export function registerAttackHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:attackSelectStart', (playerId, data) =>
    engine.attackSelectStart(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:attackSelectEnd', (playerId, data) =>
    engine.attackSelectEnd(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:attack', (playerId, data) =>
    engine.attack(playerId, data.type, data.troops),
  );

  registerGameAction(socket, 'game:attackMove', (playerId, data) =>
    engine.attackMove(playerId, data.troops),
  );

  registerGameAction(socket, 'game:quickAttack', (playerId, data) =>
    engine.quickAttack(playerId, data.territoryId, data.minimal),
  );
}
