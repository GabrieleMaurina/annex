import { randomPlayerName } from 'engine';

export function anonNameFor(token: string): string {
  const seed = parseInt(token.slice(0, 8), 16);
  if (!Number.isFinite(seed)) return randomPlayerName();
  return `Player${(seed % 9000) + 1000}`;
}
