import { Game } from '../types';

const ALIAS_BASE = 2 ** 30;

function drawAlias(game: Game): number {
  const taken = new Set(game.aliases.values());
  let alias;
  do
    alias =
      ALIAS_BASE + (crypto.getRandomValues(new Uint32Array(1))[0] % ALIAS_BASE);
  while (taken.has(alias));
  return alias;
}

export function aliasOf(game: Game, realId: number): number {
  if (realId === 0) return 0;
  const existing = game.aliases.get(realId);
  if (existing !== undefined) return existing;
  const alias = drawAlias(game);
  game.aliases.set(realId, alias);
  return alias;
}

export function aliasesOf(game: Game, realIds: number[]): number[] {
  return realIds.map((id) => aliasOf(game, id));
}

export function realOf(game: Game, alias: unknown): number | undefined {
  for (const [realId, candidate] of game.aliases) {
    if (candidate === alias) return realId;
  }
  return undefined;
}
