import { TERRITORY_CAP } from '../../game/world/starvation';
import { Game } from '../../types';

const PRESSURE_START_ROUND = 150;
const PRESSURE_RAMP_ROUNDS = 150;
const MIN_WIN_PROBABILITY = 0.55;
const RELAXED_MIN_WIN_PROBABILITY = 0.3;
const FRUSTRATION_START_ROUND = 50;
const HEAVY_TERRITORY_TROOPS = 100;
const CAPPED_HEAVY_TERRITORY_SHARE = 0.95;
const HEAVY_TERRITORY_COUNT = 2;
const FRUSTRATION_BASE = 0.3;
const FRUSTRATION_ROUND_RAMP = 250;
const FRUSTRATION_ROUND_SHARE = 0.4;
const FRUSTRATION_HEAVY_RAMP = 30;
const FRUSTRATION_HEAVY_SHARE = 0.3;

function heavyTerritoryTroops(game: Game): number {
  if (game.starvation === 'territory')
    return Math.floor(TERRITORY_CAP * CAPPED_HEAVY_TERRITORY_SHARE);
  return HEAVY_TERRITORY_TROOPS;
}

function heavyTerritoryCount(game: Game): number {
  const heavyTroops = heavyTerritoryTroops(game);
  let count = 0;
  for (const troops of game.territoryTroops.values()) {
    if (troops >= heavyTroops) count++;
  }
  return count;
}

export function frustrationLevel(game: Game): number {
  if (game.roundNumber < FRUSTRATION_START_ROUND) return 0;
  const heavy = heavyTerritoryCount(game);
  if (heavy < HEAVY_TERRITORY_COUNT) return stalemateRamp(game);
  const roundShare = Math.min(
    FRUSTRATION_ROUND_SHARE,
    (game.roundNumber - FRUSTRATION_START_ROUND) / FRUSTRATION_ROUND_RAMP,
  );
  const heavyShare = Math.min(
    FRUSTRATION_HEAVY_SHARE,
    (heavy - HEAVY_TERRITORY_COUNT) / FRUSTRATION_HEAVY_RAMP,
  );
  return Math.max(
    stalemateRamp(game),
    Math.min(1, FRUSTRATION_BASE + roundShare + heavyShare),
  );
}

export function stalemateRamp(game: Game): number {
  const ramp = (game.roundNumber - PRESSURE_START_ROUND) / PRESSURE_RAMP_ROUNDS;
  return Math.min(1, Math.max(0, ramp));
}

export function stalematePressure(game: Game): number {
  return Math.max(frustrationLevel(game), stalemateRamp(game));
}

export function minWinProbability(game: Game): number {
  return (
    MIN_WIN_PROBABILITY -
    (MIN_WIN_PROBABILITY - RELAXED_MIN_WIN_PROBABILITY) *
      stalematePressure(game)
  );
}
