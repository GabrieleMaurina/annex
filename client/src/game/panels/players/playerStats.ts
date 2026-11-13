import type { Player } from './rows/rowTypes';

export type StatKey =
  | 'team'
  | 'territories'
  | 'capitals'
  | 'points'
  | 'bounties'
  | 'troops'
  | 'cards';

export interface StatDef {
  key: StatKey;
  icon: string;
  title: string;
  value: (player: Player) => string | number;
}

interface StatOptions {
  isTeamDeathmatch: boolean;
  isCapitals: boolean;
  showPoints: boolean;
  showBounties: boolean;
  showCards: boolean;
}

export interface ProgressContext {
  isCapitals: boolean;
  totalCapitals: number;
  showPoints: boolean;
  maxPoints: number;
  territoriesToWin: number | null;
}

export type Progress = number | 'hidden' | null;

export const LINE_STATS: StatKey[] = [
  'territories',
  'troops',
  'capitals',
  'points',
  'cards',
];
export const CHIP_STATS: StatKey[] = [
  'territories',
  'troops',
  'capitals',
  'points',
];

export function statDefs(options: StatOptions): StatDef[] {
  const defs: StatDef[] = [];
  if (options.isTeamDeathmatch)
    defs.push({
      key: 'team',
      icon: '/icons/team.svg',
      title: 'Team',
      value: (p) => p.team + 1,
    });
  defs.push({
    key: 'territories',
    icon: '/icons/territory.svg',
    title: 'Territories',
    value: (p) => (p.eliminated ? '-' : (p.territoryCount ?? '?')),
  });
  if (options.isCapitals)
    defs.push({
      key: 'capitals',
      icon: '/icons/capital.svg',
      title: 'Capitals',
      value: (p) => (p.eliminated ? '-' : p.capitalCount),
    });
  if (options.showPoints)
    defs.push({
      key: 'points',
      icon: '/icons/points.svg',
      title: 'Points',
      value: (p) => p.points,
    });
  if (options.showBounties)
    defs.push({
      key: 'bounties',
      icon: '/icons/bounty.svg',
      title: 'Bounties',
      value: (p) => p.playersKilled?.length ?? '?',
    });
  defs.push({
    key: 'troops',
    icon: '/icons/tank.svg',
    title: 'Troops',
    value: (p) => (p.eliminated ? '-' : (p.troopCount ?? '?')),
  });
  if (options.showCards)
    defs.push({
      key: 'cards',
      icon: '/icons/cards.svg',
      title: 'Cards',
      value: (p) => (p.eliminated ? '-' : p.cardCount),
    });
  return defs;
}

export function pickStats(defs: StatDef[], keys: StatKey[]): StatDef[] {
  return defs.filter((def) => keys.includes(def.key));
}

export function progressFor(
  player: Player,
  context: ProgressContext,
): Progress {
  if (player.eliminated) return null;
  if (context.showPoints)
    return context.maxPoints > 0
      ? Math.min(100, (player.points / context.maxPoints) * 100)
      : null;
  if (context.isCapitals)
    return context.totalCapitals > 0
      ? (player.capitalCount / context.totalCapitals) * 100
      : null;
  if (context.territoriesToWin === null) return null;
  if (player.territoryCount === null) return 'hidden';
  return Math.min(
    100,
    (player.territoryCount / context.territoriesToWin) * 100,
  );
}
