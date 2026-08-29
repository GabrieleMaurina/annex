import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../../socketRooms';
import { isObject } from '../../../validate';
import { registerGameAction } from '../../handlerHelpers';

export function registerAttackHandlers(socket: Socket, engine: Engine) {
  registerGameAction(socket, 'game:attackSelectStart', (playerId, data) =>
    engine.attackSelectStart(playerId, data.territoryId),
  );

  socket.on(
    'game:attackSelectEnd',
    (data: unknown, callback: (response: unknown) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const territoryId = isObject(data) ? data.territoryId : undefined;
      callback(engine.attackSelectEnd(playerId, territoryId));
    },
  );

  socket.on(
    'game:attack',
    (data: unknown, callback: (response: unknown) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const { type, troops } = isObject(data)
        ? data
        : ({} as Record<string, unknown>);
      callback(engine.attack(playerId, type, troops));
    },
  );

  registerGameAction(socket, 'game:attackMove', (playerId, data) =>
    engine.attackMove(playerId, data.troops),
  );
}
