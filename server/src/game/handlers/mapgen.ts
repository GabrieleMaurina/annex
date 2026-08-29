import {
  Engine,
  MAP_SIZE_VALUES,
  MapSize,
  WATER_LEVEL_VALUES,
  WaterLevel,
} from 'engine';
import { Socket } from 'socket.io';
import { playerIdBySocketId } from '../../socketRooms';
import { isObject } from '../../validate';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

export function registerMapGenHandlers(socket: Socket, engine: Engine) {
  socket.on(
    'game:generateMap',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });

      const input: Record<string, unknown> = isObject(data) ? data : {};
      const seed = input.seed;
      if (typeof seed !== 'string')
        return callback({ ok: false, error: 'invalid seed' });
      if (!(MAP_SIZE_VALUES as unknown[]).includes(input.size))
        return callback({ ok: false, error: 'invalid size' });
      if (!(WATER_LEVEL_VALUES as unknown[]).includes(input.water))
        return callback({ ok: false, error: 'invalid water' });

      engine.generateMap(
        playerId,
        seed,
        input.size as MapSize,
        input.water as WaterLevel,
        callback,
      );
    },
  );
}
