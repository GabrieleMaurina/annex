import { Game, GameLogEvent } from '../../types';
import { Advances, Placements } from './model';

const FULL_WEIGHT_AGE = 2;
const CUTOFF_AGE = 10;
const ADVANCE_CUTOFF_AGE = 12;
const FADE_EXPONENT = 2;

interface Advance {
  playerId: number;
  continentId: number;
  troops: number;
}

interface DeployedPayload {
  territoryId: number;
  troops: number;
  playerId: number;
}

interface DeployedManyPayload {
  deposits: { territoryId: number; troops: number }[];
  playerId: number;
}

interface AttackedPayload {
  defendingTerritoryId: number;
  attackerId: number;
  conquered?: boolean;
}

interface TurnStartedPayload {
  roundNumber: number;
}

export interface Activity {
  placements: Placements;
  advances: Advances;
}

interface ActivityCache {
  length: number;
  roundNumber: number;
  activity: Activity;
}

const caches = new WeakMap<GameLogEvent[], ActivityCache>();

export function placementWeight(age: number): number {
  if (age <= FULL_WEIGHT_AGE) return 1;
  if (age >= CUTOFF_AGE) return 0;
  return ((CUTOFF_AGE - age) / (CUTOFF_AGE - FULL_WEIGHT_AGE)) ** FADE_EXPONENT;
}

function advancesOf(
  entry: GameLogEvent,
  continentOf: Map<number, number>,
): Advance[] {
  if (
    entry.type === 'game:deployed' ||
    entry.type === 'game:territoryClaimed'
  ) {
    const payload = entry.payload as DeployedPayload;
    const continentId = continentOf.get(payload.territoryId);
    return continentId === undefined
      ? []
      : [{ playerId: payload.playerId, continentId, troops: payload.troops }];
  }
  if (entry.type === 'game:attacked') {
    const payload = entry.payload as AttackedPayload;
    const continentId = continentOf.get(payload.defendingTerritoryId);
    return !payload.conquered || continentId === undefined
      ? []
      : [{ playerId: payload.attackerId, continentId, troops: 0 }];
  }
  if (entry.type !== 'game:deployedMany') return [];
  const payload = entry.payload as DeployedManyPayload;
  return payload.deposits.flatMap((deposit) => {
    const continentId = continentOf.get(deposit.territoryId);
    return continentId === undefined
      ? []
      : [{ playerId: payload.playerId, continentId, troops: deposit.troops }];
  });
}

function addTo(
  table: Map<number, Map<number, number>>,
  continentId: number,
  playerId: number,
  update: (current: number | undefined) => number,
): void {
  const byPlayer = table.get(continentId) ?? new Map<number, number>();
  byPlayer.set(playerId, update(byPlayer.get(playerId)));
  table.set(continentId, byPlayer);
}

export function recentActivity(
  game: Game,
  botId: number,
  continentOf: Map<number, number>,
): Activity {
  const entries = game.logs.get(botId);
  if (!entries) return { placements: new Map(), advances: new Map() };
  const cached = caches.get(entries);
  if (
    cached &&
    cached.length === entries.length &&
    cached.roundNumber === game.roundNumber
  )
    return cached.activity;

  const placements: Placements = new Map();
  const advances: Advances = new Map();
  let pending: Advance[] = [];
  const settle = (age: number) => {
    const weight = placementWeight(age);
    for (const advance of pending) {
      if (age < ADVANCE_CUTOFF_AGE)
        addTo(
          advances,
          advance.continentId,
          advance.playerId,
          (current) => current ?? age,
        );
      if (weight > 0 && advance.troops > 0)
        addTo(
          placements,
          advance.continentId,
          advance.playerId,
          (current) => (current ?? 0) + weight * advance.troops,
        );
    }
    pending = [];
  };

  let expired = false;
  for (let i = entries.length - 1; i >= 0 && !expired; i--) {
    const entry = entries[i];
    if (entry.type !== 'game:turnStarted') {
      pending.push(...advancesOf(entry, continentOf));
      continue;
    }
    const age =
      game.roundNumber - (entry.payload as TurnStartedPayload).roundNumber;
    settle(age);
    expired = age >= Math.max(CUTOFF_AGE, ADVANCE_CUTOFF_AGE);
  }
  if (!expired) settle(game.roundNumber);

  const activity = { placements, advances };
  caches.set(entries, {
    length: entries.length,
    roundNumber: game.roundNumber,
    activity,
  });
  return activity;
}
