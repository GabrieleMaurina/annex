import { BotDifficulty } from '../types';
import { DifficultyParams } from './types';

const PARAMS: Record<Exclude<BotDifficulty, 'idle'>, DifficultyParams> = {
  easy: { noise: 0.7, planningConfidence: 0.3 },
  medium: { noise: 0.35, planningConfidence: 0.65 },
  hard: { noise: 0.1, planningConfidence: 1 },
};

export function difficultyParams(difficulty: BotDifficulty): DifficultyParams {
  if (difficulty === 'idle') return { noise: 0, planningConfidence: 0 };
  return PARAMS[difficulty];
}
