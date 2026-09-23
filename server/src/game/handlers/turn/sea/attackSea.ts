import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../../../sockets/socketRooms';
import { isObject } from '../../../../validate';
import { registerGameAction } from '../../../handlerHelpers';

export function registerAttackSeaHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:attackSeaSelectStart', (playerId, data) =>
    engine.attackSeaSelectStart(playerId, data.territoryId),
  );

  socket.on(
    'game:attackSeaSelectDefender',
    (data: unknown, callback: (response: unknown) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const defenderId = isObject(data) ? data.defenderId : undefined;
      callback(engine.attackSeaSelectDefender(playerId, defenderId));
    },
  );

  socket.on(
    'game:attackSea',
    (data: unknown, callback: (response: unknown) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const { type, ships } = isObject(data)
        ? data
        : ({} as Record<string, unknown>);
      callback(engine.attackSea(playerId, type, ships));
    },
  );
}
