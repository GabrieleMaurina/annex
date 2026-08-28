import { Weights } from '../types';
import { balancedWeights } from './balanced';
import { breakerWeights } from './breaker';
import { killerWeights } from './killer';
import { takerWeights } from './taker';
import { vengefulWeights } from './vengeful';

const ARCHETYPES: Weights[] = [
  takerWeights,
  breakerWeights,
  killerWeights,
  vengefulWeights,
  balancedWeights,
];

function randomWeights(): Weights {
  return {
    completeContinent: Math.random() * 3,
    breakContinent: Math.random() * 3,
    eliminate: Math.random() * 3,
    stack: Math.random() * 3,
    grudge: Math.random() * 3,
    defendFrontier: Math.random() * 3,
  };
}

// Resampled fresh on every call, never cached: Erratic's defining trait is
// unpredictability, not a fixed profile like the other personalities.
export function erraticWeights(): Weights {
  if (Math.random() < 0.5) return randomWeights();
  return ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
}
