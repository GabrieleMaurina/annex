import { Game, GameLogEvent } from '../../types';
import { Placements } from './model';

const FULL_WEIGHT_AGE = 2;
const CUTOFF_AGE = 10;
const FADE_EXPONENT = 2;

interface Deposit {
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

interface TurnStartedPayload {
  roundNumber: number;
}

interface PlacementCache {
  length: number;
  roundNumber: number;
  placements: Placements;
}

const caches = new WeakMap<GameLogEvent[], PlacementCache>();

export function placementWeight(age: number): number {
  if (age <= FULL_WEIGHT_AGE) return 1;
  if (age >= CUTOFF_AGE) return 0;
  return ((CUTOFF_AGE - age) / (CUTOFF_AGE - FULL_WEIGHT_AGE)) ** FADE_EXPONENT;
}

function depositsOf(
  entry: GameLogEvent,
  continentOf: Map<number, number>,
): Deposit[] {
  if (entry.type === 'game:deployed') {
    const payload = entry.payload as DeployedPayload;
    const continentId = continentOf.get(payload.territoryId);
    return continentId === undefined
      ? []
      : [{ playerId: payload.playerId, continentId, troops: payload.troops }];
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

export function recentPlacements(
  game: Game,
  botId: number,
  continentOf: Map<number, number>,
): Placements {
  const entries = game.logs.get(botId);
  if (!entries) return new Map();
  const cached = caches.get(entries);
  if (
    cached &&
    cached.length === entries.length &&
    cached.roundNumber === game.roundNumber
  )
    return cached.placements;

  const placements: Placements = new Map();
  let pending: Deposit[] = [];
  const settle = (age: number) => {
    const weight = placementWeight(age);
    if (weight > 0)
      for (const deposit of pending) {
        const byPlayer =
          placements.get(deposit.continentId) ?? new Map<number, number>();
        byPlayer.set(
          deposit.playerId,
          (byPlayer.get(deposit.playerId) ?? 0) + weight * deposit.troops,
        );
        placements.set(deposit.continentId, byPlayer);
      }
    pending = [];
  };

  let expired = false;
  for (let i = entries.length - 1; i >= 0 && !expired; i--) {
    const entry = entries[i];
    if (entry.type !== 'game:turnStarted') {
      pending.push(...depositsOf(entry, continentOf));
      continue;
    }
    const age =
      game.roundNumber - (entry.payload as TurnStartedPayload).roundNumber;
    settle(age);
    expired = age >= CUTOFF_AGE;
  }
  if (!expired) settle(game.roundNumber);

  caches.set(entries, {
    length: entries.length,
    roundNumber: game.roundNumber,
    placements,
  });
  return placements;
}
