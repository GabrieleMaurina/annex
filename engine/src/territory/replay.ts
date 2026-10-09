import { buildReplay, GameExport } from '../game/export';
import { requireGame } from '../session/context';
import { ReplayLogEntry } from '../types';

export type ReplayResponse =
  | {
      ok: true;
      replay: GameExport['replay'];
      serverLog: ReplayLogEntry[];
    }
  | { ok: false; error: string };

export function requestReplay(playerId: number): ReplayResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'ended') return { ok: false, error: 'game not ended' };

  return {
    ok: true,
    replay: buildReplay(game),
    serverLog: game.replayLog,
  };
}
