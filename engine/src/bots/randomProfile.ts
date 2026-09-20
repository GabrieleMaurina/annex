import { BotDifficulty, BotPersonality, BotProfile } from '../types';

export const DIFFICULTIES: BotDifficulty[] = ['idle', 'easy', 'medium', 'hard'];
export const PERSONALITIES: BotPersonality[] = [
  'balanced',
  'taker',
  'breaker',
  'killer',
  'vengeful',
  'defensive',
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

export function resolveBotProfile(
  difficulty: BotDifficulty | 'random',
  personality: BotPersonality | 'random',
): BotProfile {
  return {
    difficulty: resolveDifficulty(difficulty),
    difficultyHidden: difficulty === 'random',
    personality: resolvePersonality(personality),
    personalityHidden: personality === 'random',
  };
}
