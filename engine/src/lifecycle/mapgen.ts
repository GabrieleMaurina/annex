import { callbacks } from '../callbacks';
import { GenerateMapParams } from '../mapgen/core/params';
import { generateMapAsync } from '../mapgen/mapgenPool';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import { games, respondWithGameState } from '../session/store';
import { PlayerGameMap } from '../types';
import { containsProfanity } from '../util/profanity';

const MAX_SEED_LENGTH = 20;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

export function generateMap(
  playerId: number,
  input: GenerateMapParams,
  callback: (response: GameResponse) => void,
): void {
  const player = playersById.get(playerId);
  if (!player || !player.gameName)
    return callback({ ok: false, error: 'not in a game' });

  const game = games.get(player.gameName);
  if (!game) return callback({ ok: false, error: 'game not found' });
  if (game.hostId !== player.id)
    return callback({ ok: false, error: 'not the host' });
  if (game.state !== 'lobby')
    return callback({ ok: false, error: 'game already started' });

  const trimmedSeed = input.seed.trim();
  if (
    trimmedSeed.length === 0 ||
    trimmedSeed.length > MAX_SEED_LENGTH ||
    !PRINTABLE_ASCII.test(trimmedSeed) ||
    containsProfanity(trimmedSeed)
  )
    return callback({ ok: false, error: 'invalid seed' });

  const gameName = game.name;
  const hostId = player.id;
  const { size, type, fill } = input;

  generateMapAsync({ seed: trimmedSeed, size, type, fill }, (res) => {
    const current = games.get(gameName);
    if (!current || current.state !== 'lobby' || current.hostId !== hostId)
      return callback({ ok: false, error: 'game no longer available' });
    if (!res.ok) return callback({ ok: false, error: res.error });

    const generated = res.result;
    current.mapName = generated.name;
    current.playerMap = null;
    current.generatedMap = {
      territories: generated.territories,
      bonuses: generated.bonuses,
      imageSrc: generated.imageSrc,
      seed: trimmedSeed,
      size,
      type,
      fill,
    };

    for (const viewerId of [...current.playerIds, ...current.spectatorIds]) {
      callbacks.onMapGenerated(viewerId, {
        name: generated.name,
        territories: generated.territories,
        bonuses: generated.bonuses,
        imageSrc: generated.imageSrc,
      });
    }

    respondWithGameState(current, hostId, callback);
  });
}

export function selectPlayerMap(
  playerId: number,
  map: PlayerGameMap & { name: string },
  callback: (response: GameResponse) => void,
): void {
  const player = playersById.get(playerId);
  if (!player || !player.gameName)
    return callback({ ok: false, error: 'not in a game' });

  const game = games.get(player.gameName);
  if (!game) return callback({ ok: false, error: 'game not found' });
  if (game.hostId !== player.id)
    return callback({ ok: false, error: 'not the host' });
  if (game.state !== 'lobby')
    return callback({ ok: false, error: 'game already started' });

  game.mapName = map.name;
  game.generatedMap = null;
  game.playerMap = {
    id: map.id,
    territories: map.territories,
    bonuses: map.bonuses,
    imageSrc: map.imageSrc,
  };

  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onMapGenerated(viewerId, {
      name: map.name,
      territories: map.territories,
      bonuses: map.bonuses,
      imageSrc: map.imageSrc,
    });
  }

  respondWithGameState(game, player.id, callback);
}
