import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../../../socketRooms';
import { isObject } from '../../../../validate';
import { registerGameAction } from '../../../handlerHelpers';

export function registerAttackSeaHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:attackSeaSelectStart', (playerId, data) =>
    engine.attackSeaSelectStart(playerId, data.territoryId),
  );

  registerGameAction(socket, 'game:attackSeaSelectDefender', (playerId, data) =>
    engine.attackSeaSelectDefender(playerId, data.defenderId),
  );

  socket.on(
    'game:attackSea',
    (data: unknown, callback: (response: unknown) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const ships = isObject(data) ? data.ships : undefined;
      callback(engine.attackSea(playerId, ships));
    },
  );
}
