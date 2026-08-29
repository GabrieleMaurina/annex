import { gameState } from '../game/state';
import { Game } from '../types';
import { playersById } from './players';
import { games } from './store';

export type GameResponse =
  | { ok: true; game: ReturnType<typeof gameState> }
  | { ok: false; error: string };

export type GameContext =
  { ok: true; playerId: number; game: Game } | { ok: false; error: string };

export function requireGame(playerId: number | undefined): GameContext {
  const player = playerId === undefined ? undefined : playersById.get(playerId);
  if (!player || !player.gameName) return { ok: false, error: 'not in a game' };
  const game = games.get(player.gameName);
  if (!game) return { ok: false, error: 'game not found' };
  return { ok: true, playerId: player.id, game };
}
