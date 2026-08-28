import type { BotDifficulty, BotPersonality } from '../lib/types';

export const BOT_DIFFICULTY_LABELS: Record<BotDifficulty | 'random', string> = {
  idle: 'Idle',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  random: 'Random',
};
export const BOT_DIFFICULTIES: (BotDifficulty | 'random')[] = [
  'idle',
  'easy',
  'medium',
  'hard',
  'random',
];

export const BOT_PERSONALITY_LABELS: Record<BotPersonality | 'random', string> =
  {
    balanced: 'Balanced',
    taker: 'Taker',
    breaker: 'Breaker',
    killer: 'Killer',
    vengeful: 'Vengeful',
    erratic: 'Erratic',
    random: 'Random',
  };
export const BOT_PERSONALITIES: (BotPersonality | 'random')[] = [
  'balanced',
  'taker',
  'breaker',
  'killer',
  'vengeful',
  'erratic',
  'random',
];
