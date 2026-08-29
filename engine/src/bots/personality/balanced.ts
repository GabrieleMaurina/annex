import { Weights } from '../types';
import { breakerWeights } from './breaker';
import { killerWeights } from './killer';
import { takerWeights } from './taker';
import { vengefulWeights } from './vengeful';

function average(profiles: Weights[]): Weights {
  const keys = Object.keys(profiles[0]) as (keyof Weights)[];
  const result = {} as Weights;
  for (const key of keys) {
    result[key] =
      profiles.reduce((sum, p) => sum + p[key], 0) / profiles.length;
  }
  return result;
}

export const balancedWeights: Weights = average([
  takerWeights,
  breakerWeights,
  killerWeights,
  vengefulWeights,
]);
