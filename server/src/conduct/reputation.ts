import {
  DAY_MS,
  effectiveReputation,
  Engine,
  MAX_REPUTATION,
  MIN_REPUTATION,
} from 'engine';
import {
  countRecentGains,
  findUserById,
  insertReputationEvent,
  ReputationReason,
  setReputationState,
} from '../db';
import { AbandonEntry, abandonPenalty, EloPenalty, isOpponent } from '../elo';
import { playerIdByUserId } from '../sockets/socketRooms';
import { createKeyedQueue } from './keyedQueue';
import { cacheReputation } from './viewerCache';

export interface ReputationState {
  reputation: number;
  recoveryFrom: number | null;
}

export interface ReputationContext {
  reason: ReputationReason;
  gameId?: string | null;
  reportReason?: string | null;
  refId?: string | null;
  eventId?: string | null;
}

export interface ReputationChange {
  applied: number;
  eventId: string | null;
}

const NO_CHANGE: ReputationChange = { applied: 0, eventId: null };

const MAX_DAILY_GAINS = 3;

let engine: Engine | null = null;
const enqueue = createKeyedQueue();

export function setReputationEngine(value: Engine): void {
  engine = value;
}

export function recoveredState(
  stored: number,
  recoveryFrom: number | null,
  now: number,
): ReputationState {
  const reputation = effectiveReputation(stored, recoveryFrom, now);
  if (reputation >= 0) return { reputation, recoveryFrom: null };
  if (recoveryFrom === null) return { reputation, recoveryFrom };
  return {
    reputation,
    recoveryFrom: recoveryFrom + (reputation - stored) * DAY_MS,
  };
}

function clampReputation(value: number): number {
  return Math.min(MAX_REPUTATION, Math.max(MIN_REPUTATION, value));
}

function logEvent(
  userId: string,
  delta: number,
  reputation: number,
  context: ReputationContext,
): Promise<string | null> {
  return insertReputationEvent({
    id: context.eventId ?? null,
    userId,
    delta,
    reputation,
    reason: context.reason,
    reportReason: context.reportReason ?? null,
    gameId: context.gameId ?? null,
    refId: context.refId ?? null,
  }).catch((error) => {
    console.error('failed to log reputation event', error);
    return null;
  });
}

function publish(
  userId: string,
  state: ReputationState,
  createdAt: number,
): void {
  cacheReputation(userId, { ...state, createdAt });
  const playerId = playerIdByUserId.get(userId);
  if (playerId !== undefined)
    engine?.setReputation(playerId, state.reputation, state.recoveryFrom);
}

function applyReputation(
  userId: string,
  delta: number,
  context: ReputationContext | null,
): Promise<ReputationChange> {
  return findUserById(userId).then((user) => {
    if (!user) return NO_CHANGE;
    const now = Date.now();
    const recovered = recoveredState(
      user.reputation,
      user.reputationRecoveryFrom,
      now,
    );
    const credited = recovered.reputation - user.reputation;
    if (!context && credited === 0) return NO_CHANGE;
    const reputation = clampReputation(recovered.reputation + delta);
    const applied = reputation - recovered.reputation;
    const state: ReputationState = {
      reputation,
      recoveryFrom:
        reputation >= 0
          ? null
          : recovered.reputation < 0 && recovered.recoveryFrom !== null
            ? recovered.recoveryFrom
            : now,
    };
    return setReputationState(userId, state.reputation, state.recoveryFrom)
      .then(() =>
        credited > 0
          ? logEvent(userId, credited, recovered.reputation, {
              reason: 'recovery',
            })
          : undefined,
      )
      .then(() =>
        context ? logEvent(userId, applied, reputation, context) : null,
      )
      .then((eventId) => {
        publish(userId, state, user.createdAt);
        return { applied, eventId };
      });
  });
}

export function addReputation(
  userId: string,
  delta: number,
  context: ReputationContext,
): Promise<ReputationChange> {
  return enqueue(userId, () => applyReputation(userId, delta, context));
}

export function catchUpRecovery(userId: string): Promise<void> {
  return enqueue(userId, () =>
    applyReputation(userId, 0, null).then(() => undefined),
  );
}

function addGameGain(userId: string, gameId: string | null): Promise<void> {
  return enqueue(userId, () =>
    countRecentGains(userId).then((gains) =>
      gains < MAX_DAILY_GAINS
        ? applyReputation(userId, 1, { reason: 'game', gameId }).then(
            () => undefined,
          )
        : undefined,
    ),
  );
}

function applyGameReputation(
  userId: string,
  entry: AbandonEntry,
  gameId: string | null,
): Promise<void> {
  const penalty = abandonPenalty(entry);
  if (penalty === 0) return addGameGain(userId, gameId);
  const reason: EloPenalty = entry.disconnected ? 'disconnected' : 'surrender';
  return addReputation(userId, -penalty, { reason, gameId }).then(
    () => undefined,
  );
}

export function handleGameEndedReputation(
  payload: {
    gameMode: string;
    ranking: ({ playerId: number; team: number } & AbandonEntry)[];
  },
  participants: Map<number, string>,
  gameId: string | undefined,
): Promise<void> {
  const counted = payload.ranking.filter((entry) =>
    participants.has(entry.playerId),
  );
  const rated = counted.filter((entry) =>
    counted.some((other) => isOpponent(entry, other, payload.gameMode)),
  );
  return Promise.all(
    rated.map((entry) =>
      applyGameReputation(
        participants.get(entry.playerId)!,
        entry,
        gameId ?? null,
      ),
    ),
  )
    .then(() => undefined)
    .catch((error) => console.error('failed to apply game reputation', error));
}
