import { BotPersonality } from '../../../../types';
import { Weights } from '../types';
import { balancedWeights } from './balanced';
import { breakerWeights } from './breaker';
import { erraticWeights } from './erratic';
import { killerWeights } from './killer';
import { takerWeights } from './taker';
import { vengefulWeights } from './vengeful';

export function getWeights(personality: BotPersonality): Weights {
  switch (personality) {
    case 'taker':
      return takerWeights;
    case 'breaker':
      return breakerWeights;
    case 'killer':
      return killerWeights;
    case 'vengeful':
      return vengefulWeights;
    case 'erratic':
      return erraticWeights();
    case 'balanced':
      return balancedWeights;
  }
}
