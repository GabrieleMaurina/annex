import type { GenerateMapInput } from '../lib/types';

const SEED_LENGTH = 10;
const RANDOM_SEED_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const DEFAULT_MAP_GENERATION = {
  size: 'medium',
  type: 'terrain',
  fill: 'mixed',
  seas: false,
} as const;

export function randomSeed(): string {
  let result = '';
  for (let i = 0; i < SEED_LENGTH; i++) {
    result +=
      RANDOM_SEED_ALPHABET[
        Math.floor(Math.random() * RANDOM_SEED_ALPHABET.length)
      ];
  }
  return result;
}

export function randomMapInput(): GenerateMapInput {
  return { seed: randomSeed(), ...DEFAULT_MAP_GENERATION };
}
