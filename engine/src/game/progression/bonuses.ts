import { getGameMap } from '../../maps/maps';
import { Continents, Game } from '../../types';
import { heldContinentIds, shuffle } from '../mechanics';

const MULTIPLIERS: Partial<Record<Continents, number>> = {
  '2x': 2,
  '3x': 3,
  '5x': 5,
  '10x': 10,
};

const RANDOM_MEAN = 5;
const RANDOM_STD_DEV = 3;
const RANDOM_MIN = 1;
const RANDOM_MAX = 10;

const LINEAR_START = 1;
const EXPONENTIAL_START = 3;
const EXPONENTIAL_RATE = 1.1;
const MAX_BONUS = 100_000;

function gaussian(): number {
  return (
    Math.sqrt(-2 * Math.log(1 - Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  );
}

function randomBonus(): number {
  let bonus: number;
  do {
    bonus = Math.round(RANDOM_MEAN + RANDOM_STD_DEV * gaussian());
  } while (bonus < RANDOM_MIN || bonus > RANDOM_MAX);
  return bonus;
}

function isLinear(mode: Continents): boolean {
  return mode === 'linear' || mode === 'linear per continent';
}

function isExponential(mode: Continents): boolean {
  return mode === 'exponential' || mode === 'exponential per continent';
}

function isProgressive(mode: Continents): boolean {
  return isLinear(mode) || isExponential(mode);
}

function isPerContinent(mode: Continents): boolean {
  return (
    mode === 'linear per continent' || mode === 'exponential per continent'
  );
}

function progressiveBonus(mode: Continents, payouts: number): number {
  if (isLinear(mode)) return LINEAR_START + payouts;
  return Math.min(
    MAX_BONUS,
    Math.round(EXPONENTIAL_START * EXPONENTIAL_RATE ** payouts),
  );
}

function startingBonuses(mode: Continents, bonuses: number[]): number[] {
  if (mode === 'shuffle') return shuffle(bonuses);
  if (mode === 'random') return bonuses.map(randomBonus);
  if (isProgressive(mode)) return bonuses.map(() => progressiveBonus(mode, 0));
  return bonuses.map((bonus) => bonus * (MULTIPLIERS[mode] ?? 1));
}

export function initializeContinentBonuses(game: Game) {
  const bonuses = getGameMap(game).bonuses;
  game.continentBonuses = startingBonuses(game.continents, bonuses);
  game.continentPayouts = bonuses.map(() => 0);
}

export function payContinentBonuses(game: Game, playerId: number) {
  const mode = game.continents;
  if (!isProgressive(mode)) return;
  for (const id of heldContinentIds(game, playerId))
    game.continentPayouts[id]++;
  const total = game.continentPayouts.reduce((sum, n) => sum + n, 0);
  game.continentBonuses = game.continentPayouts.map((payouts) =>
    progressiveBonus(mode, isPerContinent(mode) ? payouts : total),
  );
}
