import {
  PlanContext,
  SimState,
  isFriendly,
  safetyAt,
} from '../planning/context';
import { Objective } from '../planning/turnPlan';
import { continentClaims } from './model';

const CLAIM_VALUE = 0.5;
const RIVAL_CLAIM_COST = 0.3;
const CONTEST_DISCOUNT = 0.8;
const PUNISH = 0.2;
const GREED_MIN_FACTOR = 0.8;
const GREED_MAX_FACTOR = 1.6;
const HOPELESS_RIVAL_CLAIM = 0.8;
const HOPELESS_OWN_CLAIM = 0.15;

export interface ClaimEvaluation {
  score: number;
  progressScale: Map<number, number>;
}

function strongestRival(
  ctx: PlanContext,
  claims: Map<number, number> | undefined,
): number {
  let strongest = 0;
  if (claims)
    for (const [playerId, claim] of claims)
      if (!isFriendly(ctx, playerId) && claim > strongest) strongest = claim;
  return strongest;
}

function rivalThreat(
  ctx: PlanContext,
  claims: Map<number, number>,
  greed: Map<number, number>,
): number {
  let threat = 0;
  for (const [playerId, claim] of claims)
    if (!isFriendly(ctx, playerId))
      threat += claim * (1 + (greed.get(playerId) ?? 0));
  return threat;
}

export function contestedShare(ctx: PlanContext, continentId: number): number {
  return strongestRival(ctx, ctx.claims?.current.get(continentId));
}

export function evaluateClaims(
  ctx: PlanContext,
  state: SimState,
  scale: number,
): ClaimEvaluation | null {
  const claims = ctx.claims;
  if (!claims) return null;
  let score = 0;
  const progressScale = new Map<number, number>();
  for (const continent of claims.setup.continents) {
    const byPlayer = continentClaims(
      claims.setup,
      continent,
      state.owners,
      state.troops,
    );
    const rival = strongestRival(ctx, byPlayer);
    score +=
      continent.bonus *
      safetyAt(ctx, continent.id) *
      (CLAIM_VALUE * (byPlayer.get(ctx.botId) ?? 0) * (1 - rival) -
        RIVAL_CLAIM_COST * rivalThreat(ctx, byPlayer, claims.greed));
    progressScale.set(continent.id, 1 - CONTEST_DISCOUNT * rival);
  }
  for (const [playerId, damage] of state.damageByPlayer) {
    const intruder = claims.intruders.get(playerId);
    if (intruder) score += (PUNISH * intruder.severity * damage) / scale;
  }
  return { score, progressScale };
}

export function claimFactor(ctx: PlanContext, objective: Objective): number {
  const claims = ctx.claims;
  if (!claims || objective.targetPlayerId === null) return 1;
  const greed = claims.greed.get(objective.targetPlayerId) ?? 0;
  return GREED_MIN_FACTOR + (GREED_MAX_FACTOR - GREED_MIN_FACTOR) * greed;
}

export function hopelessContinent(
  ctx: PlanContext,
  continentId: number,
): boolean {
  const claims = ctx.claims;
  if (!claims) return false;
  const own = claims.current.get(continentId)?.get(ctx.botId) ?? 0;
  return (
    contestedShare(ctx, continentId) >= HOPELESS_RIVAL_CLAIM &&
    own < HOPELESS_OWN_CLAIM
  );
}

export function claimScore(ctx: PlanContext, continentId: number): number {
  const claims = ctx.claims;
  const continent = claims?.setup.continents.find((c) => c.id === continentId);
  if (!claims || !continent) return 0;
  const byPlayer = claims.current.get(continentId);
  return (
    continent.bonus *
    safetyAt(ctx, continentId) *
    (byPlayer?.get(ctx.botId) ?? 0) *
    (1 - strongestRival(ctx, byPlayer))
  );
}
