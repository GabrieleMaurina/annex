import { playersById } from '../session/players';
import { Game, Player } from '../types';

export const RANKS = [
  { name: 'Private', minElo: 0 },
  { name: 'Specialist', minElo: 400 },
  { name: 'Corporal', minElo: 600 },
  { name: 'Sergeant', minElo: 800 },
  { name: 'Lieutenant', minElo: 1000 },
  { name: 'Captain', minElo: 1200 },
  { name: 'Major', minElo: 1400 },
  { name: 'Commander', minElo: 1600 },
  { name: 'Colonel', minElo: 1800 },
  { name: 'Brigadier', minElo: 2000 },
  { name: 'Commodore', minElo: 2300 },
  { name: 'Admiral', minElo: 2600 },
  { name: 'General', minElo: 3000 },
];

export const MIN_RANK_VALUES = RANKS.map((rank) => rank.name.toLowerCase());

export const MIN_GAMES_VALUES = [
  ...Array.from({ length: 11 }, (_, i) => i),
  ...Array.from({ length: 18 }, (_, i) => 15 + i * 5),
  ...Array.from({ length: 18 }, (_, i) => 150 + i * 50),
];

export const MIN_ACCOUNT_AGE_VALUES = [
  'none',
  '1 week',
  '2 weeks',
  '3 weeks',
  '1 month',
  ...Array.from({ length: 10 }, (_, i) => `${i + 2} months`),
  '1 year',
];

export function meetsMinRank(minRank: string, elo: number | null): boolean {
  const minElo = RANKS[MIN_RANK_VALUES.indexOf(minRank)].minElo;
  return minElo === 0 || (elo !== null && elo >= minElo);
}

export function meetsMinGames(
  minGames: number,
  gamesPlayed: number | null,
): boolean {
  return (gamesPlayed ?? 0) >= minGames;
}

export function meetsMinAccountAge(
  minAccountAge: string,
  accountCreatedAt: number | null,
): boolean {
  if (minAccountAge === 'none') return true;
  if (accountCreatedAt === null) return false;
  const [count, unit] = minAccountAge.split(' ');
  const cutoff = new Date();
  if (unit.startsWith('week'))
    cutoff.setDate(cutoff.getDate() - 7 * Number(count));
  else if (unit.startsWith('month'))
    cutoff.setMonth(cutoff.getMonth() - Number(count));
  else cutoff.setFullYear(cutoff.getFullYear() - Number(count));
  return accountCreatedAt <= cutoff.getTime();
}

export function meetsRequirements(
  requirements: Pick<Game, 'minRank' | 'minGames' | 'minAccountAge'>,
  profile: Pick<Player, 'elo' | 'gamesPlayed' | 'accountCreatedAt'>,
): boolean {
  return (
    meetsMinRank(requirements.minRank, profile.elo) &&
    meetsMinGames(requirements.minGames, profile.gamesPlayed) &&
    meetsMinAccountAge(requirements.minAccountAge, profile.accountCreatedAt)
  );
}

export function canTakeSeat(game: Game, playerId: number): boolean {
  const player = playersById.get(playerId);
  return (
    !!player &&
    (game.offline || player.isBot || meetsRequirements(game, player))
  );
}
