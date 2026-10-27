import { containsProfanity } from '../util/profanity';

export const MAX_PLACE_NAME_LENGTH = 30;

const CONTROL_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}\u202A-\u202E\u2066-\u2069]/u;

export function isValidPlaceName(name: string): boolean {
  return (
    name === name.trim() &&
    name.length <= MAX_PLACE_NAME_LENGTH &&
    !CONTROL_CHARACTERS.test(name) &&
    !containsProfanity(name)
  );
}

export function duplicatePlaceNames(names: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates;
}
