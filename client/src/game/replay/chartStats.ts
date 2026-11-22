import type {
  ReplayHand,
  ReplayPlayerState,
  ReplayPlayerStats,
  ReplayTerritory,
} from '../../lib/types';

export interface Sample {
  hands: ReplayHand[];
  territories: ReplayTerritory[];
  playerStates: ReplayPlayerState[];
  playerStats: ReplayPlayerStats[];
  continentsHeld?: Map<number, number>;
  generation?: Map<number, number>;
}

type CounterKey = Exclude<keyof ReplayPlayerStats, 'playerId'>;

export interface Stat {
  label: string;
  stacked?: boolean;
  lowerIsBetter?: boolean;
  value: (sample: Sample, playerId: number, capitalIds: Set<number>) => number;
}

function counter(key: CounterKey) {
  return (sample: Sample, playerId: number) =>
    sample.playerStats.find((s) => s.playerId === playerId)?.[key] ?? 0;
}

export function playerState(sample: Sample, playerId: number) {
  return sample.playerStates.find((s) => s.playerId === playerId);
}

export type Takeover = 'surrendered' | 'disconnected' | null;

export const TAKEOVER_LABELS = {
  surrendered: 'Bot after surrender',
  disconnected: 'Disconnected',
};

export function takeoverOf(sample: Sample, playerId: number): Takeover {
  const state = playerState(sample, playerId);
  if (state?.surrendered) return 'surrendered';
  if (state?.connected === false && !state.eliminated) return 'disconnected';
  return null;
}

export const TAKEOVER_DASH = { surrendered: '10 6', disconnected: '2 6' };

export const TROOPS: Stat = {
  label: 'Troops',
  value: (sample, playerId) =>
    sample.territories
      .filter((t) => t.ownerId === playerId)
      .reduce((sum, t) => sum + t.troops, 0),
};

export const TERRITORIES: Stat = {
  label: 'Territories',
  value: (sample, playerId) =>
    sample.territories.filter((t) => t.ownerId === playerId).length,
};

export const LARGEST_STACK: Stat = {
  label: 'Largest Stack',
  value: (sample, playerId) =>
    Math.max(
      0,
      ...sample.territories
        .filter((t) => t.ownerId === playerId)
        .map((t) => t.troops),
    ),
};

export const CARDS_IN_HAND: Stat = {
  label: 'Cards In Hand',
  value: (sample, playerId) =>
    sample.hands.find((h) => h.playerId === playerId)?.cards.length ?? 0,
};

export const CAPITALS: Stat = {
  label: 'Capitals',
  value: (sample, playerId, capitalIds) =>
    sample.territories.filter(
      (t) => t.ownerId === playerId && capitalIds.has(t.id),
    ).length,
};

export const TERRITORY_OWNERSHIP: Stat = {
  ...TERRITORIES,
  label: 'Territory Ownership',
  stacked: true,
};

export const CAPITAL_OWNERSHIP: Stat = {
  ...CAPITALS,
  label: 'Capital Ownership',
  stacked: true,
};

export const CONTINENT_BONUSES: Stat = {
  label: 'Bonuses',
  value: (sample, playerId) => sample.continentsHeld?.get(playerId) ?? 0,
};

export const GENERATION: Stat = {
  label: 'Generation',
  value: (sample, playerId) =>
    playerState(sample, playerId)?.eliminated
      ? 0
      : (sample.generation?.get(playerId) ?? 0),
};

export const POINTS: Stat = {
  label: 'Points',
  value: (sample, playerId) => playerState(sample, playerId)?.points ?? 0,
};

export const PLAYERS_KILLED: Stat = {
  label: 'Players Killed',
  value: (sample, playerId) =>
    playerState(sample, playerId)?.killedPlayerIds.length ?? 0,
};

export const TROOPS_GAINED: Stat = {
  label: 'Troops Gained',
  value: counter('troopsGained'),
};
export const TROOPS_KILLED: Stat = {
  label: 'Troops Killed',
  value: counter('troopsKilled'),
};
export const TROOPS_LOST: Stat = {
  lowerIsBetter: true,
  label: 'Troops Lost',
  value: counter('troopsLost'),
};
export const TERRITORIES_CONQUERED: Stat = {
  label: 'Territories Conquered',
  value: counter('territoriesConquered'),
};
export const TERRITORIES_LOST: Stat = {
  lowerIsBetter: true,
  label: 'Territories Lost',
  value: counter('territoriesLost'),
};
export const CAPITALS_CONQUERED: Stat = {
  label: 'Capitals Conquered',
  value: counter('capitalsConquered'),
};
export const CAPITALS_LOST: Stat = {
  lowerIsBetter: true,
  label: 'Capitals Lost',
  value: counter('capitalsLost'),
};
export const CARDS_GAINED: Stat = {
  label: 'Cards Gained',
  value: counter('cardsGained'),
};
export const CARDS_STOLEN: Stat = {
  label: 'Cards Stolen',
  value: counter('cardsStolen'),
};
export const SETS_PLAYED: Stat = {
  label: 'Sets Played',
  value: counter('setsPlayed'),
};
