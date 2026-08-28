import { Server, Socket } from 'socket.io';
import {
  MAP_SIZE_VALUES,
  MapSize,
  WATER_LEVEL_VALUES,
  WaterLevel,
} from '../../mapgen/core/params';
import { generateMap } from '../../mapgen/generate';
import { containsProfanity } from '../../profanity';
import { Player } from '../../types';
import { isObject } from '../../validate';
import { gameState } from '../logic/state';
import { gameRoomName, games, respondWithGameState } from '../logic/store';

const MAX_SEED_LENGTH = 20;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

type GenerateMapResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export function registerMapGenHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
  playersById: Map<number, Player>,
) {
  socket.on(
    'game:generateMap',
    (data: unknown, callback: (response: GenerateMapResponse) => void) => {
      if (typeof callback !== 'function') return;
      const player = playersBySocket.get(socket.id);
      if (!player || !player.gameName)
        return callback({ ok: false, error: 'not in a game' });

      const game = games.get(player.gameName);
      if (!game) return callback({ ok: false, error: 'game not found' });
      if (game.hostId !== player.id)
        return callback({ ok: false, error: 'not the host' });
      if (game.state !== 'lobby')
        return callback({ ok: false, error: 'game already started' });

      const input: Record<string, unknown> = isObject(data) ? data : {};

      const seed = input.seed;
      const trimmedSeed = typeof seed === 'string' ? seed.trim() : '';
      if (
        typeof seed !== 'string' ||
        trimmedSeed.length === 0 ||
        trimmedSeed.length > MAX_SEED_LENGTH ||
        !PRINTABLE_ASCII.test(trimmedSeed) ||
        containsProfanity(trimmedSeed)
      )
        return callback({ ok: false, error: 'invalid seed' });

      if (!(MAP_SIZE_VALUES as unknown[]).includes(input.size))
        return callback({ ok: false, error: 'invalid size' });

      if (!(WATER_LEVEL_VALUES as unknown[]).includes(input.water))
        return callback({ ok: false, error: 'invalid water' });

      const generated = generateMap({
        seed: trimmedSeed,
        size: input.size as MapSize,
        water: input.water as WaterLevel,
      });

      game.mapName = generated.name;
      game.generatedMap = {
        territories: generated.territories,
        bonuses: generated.bonuses,
        displayName: generated.displayName,
        imageSrc: generated.imageSrc,
      };

      io.to(gameRoomName(game.name)).emit('game:mapGenerated', {
        name: generated.name,
        displayName: generated.displayName,
        territories: generated.territories,
        bonuses: generated.bonuses,
        imageSrc: generated.imageSrc,
      });

      respondWithGameState(io, playersById, game, player.id, callback);
    },
  );
}
