import { BotStyle, Weights } from '../types';
import { balancedWeights } from './balanced';
import { breakerWeights } from './breaker';
import { killerWeights } from './killer';
import { hoarderWeights } from './specialists/hoarder';
import { opportunistWeights } from './specialists/opportunist';
import { policeWeights } from './specialists/police';
import { takerWeights } from './taker';
import { vengefulWeights } from './vengeful';

function archetypes(): BotStyle[] {
  return [
    { personality: 'erratic', weights: takerWeights },
    { personality: 'erratic', weights: breakerWeights },
    { personality: 'erratic', weights: killerWeights },
    { personality: 'erratic', weights: vengefulWeights },
    { personality: 'erratic', weights: balancedWeights },
    { personality: 'police', weights: policeWeights },
    { personality: 'hoarder', weights: hoarderWeights },
    { personality: 'opportunist', weights: opportunistWeights },
  ];
}

function randomWeights(): Weights {
  return {
    completeContinent: Math.random() * 3,
    breakContinent: Math.random() * 3,
    eliminate: Math.random() * 3,
    stack: Math.random() * 3,
    grudge: Math.random() * 3,
    defendFrontier: Math.random() * 3,
    antiLeader: Math.random() * 3,
    defense: Math.random() * 3,
    holdChokepoint: Math.random() * 3,
    duelBreak: Math.random() * 3,
    duelStack: Math.random() * 3,
    duelRoll: Math.random() * 3,
    aggression: Math.random(),
    keepStack: Math.random(),
  };
}

export function erraticStyle(): BotStyle {
  if (Math.random() < 0.5)
    return { personality: 'erratic', weights: randomWeights() };
  const styles = archetypes();
  return styles[Math.floor(Math.random() * styles.length)];
}
