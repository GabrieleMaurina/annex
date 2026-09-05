export interface Rank {
  name: string;
  image: string;
  minElo: number;
}

export const RANKS: Rank[] = [
  { name: 'Private', image: '01_private', minElo: 0 },
  { name: 'Specialist', image: '02_specialist', minElo: 400 },
  { name: 'Corporal', image: '03_corporal', minElo: 600 },
  { name: 'Sergeant', image: '04_sergeant', minElo: 800 },
  { name: 'Lieutenant', image: '05_lieutenant', minElo: 1000 },
  { name: 'Captain', image: '06_captain', minElo: 1200 },
  { name: 'Major', image: '07_major', minElo: 1400 },
  { name: 'Commander', image: '08_commander', minElo: 1600 },
  { name: 'Colonel', image: '09_colonel', minElo: 1800 },
  { name: 'Brigadier', image: '10_brigadier', minElo: 2000 },
  { name: 'Commodore', image: '11_commodore', minElo: 2300 },
  { name: 'Admiral', image: '12_admiral', minElo: 2600 },
  { name: 'General', image: '13_general', minElo: 3000 },
];

export function rankForElo(elo: number): Rank {
  let rank = RANKS[0];
  for (const candidate of RANKS) {
    if (elo >= candidate.minElo) rank = candidate;
  }
  return rank;
}
