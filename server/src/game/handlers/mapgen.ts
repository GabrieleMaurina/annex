import {
  Engine,
  Fill,
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_ASPECT_VALUES,
  MAP_SIZE_VALUES,
  MapAspect,
  MapSize,
  TILE_SHAPE_VALUES,
  TileShape,
  viewResponse,
} from 'engine';
import { Socket } from 'socket.io';
import { getPlayerMapById } from '../../db';
import { playerIdBySocketId } from '../../sockets/socketRooms';
import { isObject } from '../../validate';

type GameResponse = { ok: true; game: unknown } | { ok: false; error: string };

export function registerMapGenHandlers(socket: Socket, engine: Engine) {
  socket.on(
    'game:selectPlayerMap',
    (data: unknown, callback: (response: GameResponse) => void) => {
      if (typeof callback !== 'function') return;
      const playerId = playerIdBySocketId.get(socket.id);
      if (playerId === undefined)
        return callback({ ok: false, error: 'not in a game' });

      const input: Record<string, unknown> = isObject(data) ? data : {};
      const mapId = input.mapId;
      if (typeof mapId !== 'string')
        return callback({ ok: false, error: 'invalid map' });

      getPlayerMapById(mapId)
        .then((map) => {
          if (!map || map.dangerous)
            return callback({ ok: false, error: 'map unavailable' });
          engine.selectPlayerMap(
            playerId,
            {
              id: map.id,
              name: map.name,
              territories: map.territories,
              seaTerritories: map.seaTerritories,
              bonuses: map.bonuses,
              wraps: map.wraps,
              timedConnections: map.timedConnections,
              lockedTiles: map.lockedTiles,
              imageSrc: `data:${map.imageMime};base64,${map.image}`,
              borderColors: map.borderColors,
              territoryNames: map.territoryNames,
              seaNames: map.seaNames,
              continentNames: map.continentNames,
            },
            (response) => callback(viewResponse(playerId, response)),
          );
        })
        .catch(() => callback({ ok: false, error: 'server error' }));
    },
  );

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
      if (!(GENERATION_TYPE_VALUES as unknown[]).includes(input.type))
        return callback({ ok: false, error: 'invalid type' });
      if (!(FILL_VALUES as unknown[]).includes(input.fill))
        return callback({ ok: false, error: 'invalid fill' });
      if (!(TILE_SHAPE_VALUES as unknown[]).includes(input.tile))
        return callback({ ok: false, error: 'invalid tile' });
      if (typeof input.seas !== 'boolean')
        return callback({ ok: false, error: 'invalid seas' });
      if (typeof input.timed !== 'boolean')
        return callback({ ok: false, error: 'invalid timed' });
      if (
        typeof input.unlockable !== 'boolean' ||
        (input.unlockable &&
          (input.type !== 'tile' || input.seas || input.timed))
      )
        return callback({ ok: false, error: 'invalid unlockable' });
      const aspect = input.aspect ?? 'wide';
      if (!(MAP_ASPECT_VALUES as unknown[]).includes(aspect))
        return callback({ ok: false, error: 'invalid aspect' });

      engine.generateMap(
        playerId,
        {
          seed,
          size: input.size as MapSize,
          type: input.type as GenerationType,
          fill: input.fill as Fill,
          tile: input.tile as TileShape,
          seas: input.seas,
          timed: input.timed,
          unlockable: input.unlockable,
          aspect: aspect as MapAspect,
        },
        (response) => callback(viewResponse(playerId, response)),
      );
    },
  );
}
