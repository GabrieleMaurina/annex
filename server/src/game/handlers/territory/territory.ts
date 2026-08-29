import { Engine } from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../../socketRooms';
import { isObject } from '../../../validate';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

export function registerTerritoryHandlers(socket: Socket, engine: Engine) {
  socket.on(
    'game:claimTerritory',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });
      const territoryId = isObject(data) ? data.territoryId : undefined;
      callback(engine.claimTerritory(playerId, territoryId));
    },
  );
}
