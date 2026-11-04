import { BotPersonality } from '../../types';
import { Weights } from '../types';
import { balancedWeights } from './balanced';
import { breakerWeights } from './breaker';
import { defensiveWeights } from './defensive';
import { erraticStyle } from './erratic';
import { killerWeights } from './killer';
import { hoarderWeights } from './specialists/hoarder';
import { opportunistWeights } from './specialists/opportunist';
import { policeWeights } from './specialists/police';
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
    case 'defensive':
      return defensiveWeights;
    case 'erratic':
      return erraticStyle().weights;
    case 'balanced':
      return balancedWeights;
    case 'police':
      return policeWeights;
    case 'hoarder':
      return hoarderWeights;
    case 'opportunist':
      return opportunistWeights;
  }
}
