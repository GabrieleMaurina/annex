import { BotDifficulty, BotPersonality } from '../types';

export const DIFFICULTIES: BotDifficulty[] = ['idle', 'easy', 'medium', 'hard'];
export const PERSONALITIES: BotPersonality[] = [
  'balanced',
  'taker',
  'breaker',
  'killer',
  'vengeful',
  'erratic',
];

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

export function isDifficultyInput(
  value: unknown,
): value is BotDifficulty | 'random' {
  return value === 'random' || (DIFFICULTIES as unknown[]).includes(value);
}

export function isPersonalityInput(
  value: unknown,
): value is BotPersonality | 'random' {
  return value === 'random' || (PERSONALITIES as unknown[]).includes(value);
}

export function resolveDifficulty(
  value: BotDifficulty | 'random',
): BotDifficulty {
  return value === 'random' ? pick(DIFFICULTIES) : value;
}

export function resolvePersonality(
  value: BotPersonality | 'random',
): BotPersonality {
  return value === 'random' ? pick(PERSONALITIES) : value;
}
