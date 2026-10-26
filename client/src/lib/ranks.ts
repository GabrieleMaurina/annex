import { RANKS as ENGINE_RANKS } from 'engine';

export interface Rank {
  name: string;
  image: string;
  minElo: number;
}

export const RANKS: Rank[] = ENGINE_RANKS.map((rank, index) => ({
  ...rank,
  image: `${String(index + 1).padStart(2, '0')}_${rank.name.toLowerCase()}`,
}));

export function rankForElo(elo: number): Rank {
  let rank = RANKS[0];
  for (const candidate of RANKS) {
    if (elo >= candidate.minElo) rank = candidate;
  }
  return rank;
}
