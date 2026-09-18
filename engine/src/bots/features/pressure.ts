import { Game } from '../../types';

const PRESSURE_START_ROUND = 150;
const PRESSURE_RAMP_ROUNDS = 150;
const MIN_WIN_PROBABILITY = 0.55;
const RELAXED_MIN_WIN_PROBABILITY = 0.3;

export function stalematePressure(game: Game): number {
  const ramp = (game.roundNumber - PRESSURE_START_ROUND) / PRESSURE_RAMP_ROUNDS;
  return Math.min(1, Math.max(0, ramp));
}

export function minWinProbability(game: Game): number {
  return (
    MIN_WIN_PROBABILITY -
    (MIN_WIN_PROBABILITY - RELAXED_MIN_WIN_PROBABILITY) *
      stalematePressure(game)
  );
}
