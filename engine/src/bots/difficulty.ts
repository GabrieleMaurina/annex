import { BotDifficulty } from '../types';
import { DifficultyParams } from './types';

const PARAMS: Record<Exclude<BotDifficulty, 'idle'>, DifficultyParams> = {
  easy: {
    noise: 0.77,
    planningConfidence: 0.27,
    maxPlanDepth: 3,
    optimizeFortify: false,
    maxCampaigns: 1,
    duelSkill: 0.27,
    adaptivePlanning: false,
    cardTiming: false,
  },
  medium: {
    noise: 0.37,
    planningConfidence: 0.62,
    maxPlanDepth: 7,
    optimizeFortify: true,
    maxCampaigns: 2,
    duelSkill: 0.62,
    adaptivePlanning: true,
    cardTiming: false,
  },
  hard: {
    noise: 0.1,
    planningConfidence: 1,
    maxPlanDepth: 12,
    optimizeFortify: true,
    maxCampaigns: 3,
    duelSkill: 1,
    adaptivePlanning: true,
    cardTiming: true,
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
      duelSkill: 0,
      adaptivePlanning: false,
      cardTiming: false,
    };
  return PARAMS[difficulty];
}
