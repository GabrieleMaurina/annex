import { requireGame } from '../session/context';
import { ReplayFrame, ReplayTerritory } from '../types';

export type ReplayResponse =
  | {
      ok: true;
      initial: ReplayTerritory[];
      initialRadiation: number[];
      frames: ReplayFrame[];
    }
  | { ok: false; error: string };

export function requestReplay(playerId: number): ReplayResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'ended') return { ok: false, error: 'game not ended' };

  return {
    ok: true,
    initial: game.replayInitial,
    initialRadiation: game.replayInitialRadiation,
    frames: game.replayFrames,
  };
}
