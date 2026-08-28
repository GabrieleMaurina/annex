import { Weights } from '../types';

// Absorbs the earlier "Stacker" idea: finishing a player off takes
// overwhelming force in one place, so Killer also weights consolidating
// troops into a single stack heavily.
export const killerWeights: Weights = {
  completeContinent: 0.3,
  breakContinent: 0.5,
  eliminate: 3,
  stack: 2.5,
  grudge: 0.3,
  defendFrontier: 0.5,
};

export const killerWeaknessThreshold = 0.35;
