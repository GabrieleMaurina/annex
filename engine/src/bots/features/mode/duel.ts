import { Game } from '../../../types';
import { DifficultyParams, Weights } from '../../types';

export interface DuelFocus {
  breaking: number;
  breakUrgency: number;
  stacking: number;
  rolling: number;
}

const WEIGHT_CEILING = 3;

export const NO_DUEL: DuelFocus = {
  breaking: 0,
  breakUrgency: 0,
  stacking: 0,
  rolling: 0,
};

export function duelFocus(
  game: Game,
  botId: number,
  friendlyIds: Set<number>,
  weights: Weights,
  params: DifficultyParams,
): DuelFocus {
  const dead = new Set(game.deathOrder);
  const opponents = game.playerIds.filter(
    (id) => id !== botId && !dead.has(id) && !friendlyIds.has(id),
  );
  if (opponents.length !== 1) return NO_DUEL;
  const scaled = (weight: number) =>
    Math.min(1, Math.max(0, weight) / WEIGHT_CEILING) * params.duelSkill;
  return {
    breaking: scaled(weights.duelBreak),
    breakUrgency:
      (Math.max(0, weights.duelBreak - WEIGHT_CEILING) / WEIGHT_CEILING) *
      params.duelSkill,
    stacking: scaled(weights.duelStack),
    rolling: scaled(weights.duelRoll),
  };
}
