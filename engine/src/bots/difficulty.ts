import { BotDifficulty } from '../types';
import { DifficultyParams } from './types';

const PARAMS: Record<Exclude<BotDifficulty, 'idle'>, DifficultyParams> = {
  easy: {
    noise: 0.7,
    planningConfidence: 0.3,
    maxPlanDepth: 3,
    optimizeFortify: false,
    maxCampaigns: 1,
  },
  medium: {
    noise: 0.35,
    planningConfidence: 0.65,
    maxPlanDepth: 7,
    optimizeFortify: true,
    maxCampaigns: 2,
  },
  hard: {
    noise: 0.1,
    planningConfidence: 1,
    maxPlanDepth: 12,
    optimizeFortify: true,
    maxCampaigns: 3,
  },
};

export function difficultyParams(difficulty: BotDifficulty): DifficultyParams {
  if (difficulty === 'idle')
    return {
      noise: 0,
      planningConfidence: 0,
      maxPlanDepth: 0,
      optimizeFortify: false,
      maxCampaigns: 1,
    };
  return PARAMS[difficulty];
}
