import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../socketRooms';
import { isObject } from '../../validate';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

export function registerFortifyHandlers(socket: Socket, engine: Engine) {
  socket.on(
    'game:fortifySelectStart',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const territoryId = isObject(data) ? data.territoryId : undefined;
      callback(engine.fortifySelectStart(playerId, territoryId));
    },
  );

  socket.on(
    'game:fortifySelectEnd',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const territoryId = isObject(data) ? data.territoryId : undefined;
      callback(engine.fortifySelectEnd(playerId, territoryId));
    },
  );

  socket.on(
    'game:fortify',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const troops = isObject(data) ? data.troops : undefined;
      callback(engine.fortify(playerId, troops));
    },
  );
}
