import { PlanContext, SimState, isFriendly } from '../planning/context';
import { Objective } from '../planning/turnPlan';
import { continentClaims } from './model';

const CLAIM_VALUE = 0.5;
const CONTEST_DISCOUNT = 0.8;
const PUNISH = 0.2;
const GREED_MIN_FACTOR = 0.8;
const GREED_MAX_FACTOR = 1.6;

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
      CLAIM_VALUE *
      continent.bonus *
      (byPlayer.get(ctx.botId) ?? 0) *
      (1 - rival);
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

export function claimHome(ctx: PlanContext): number | null {
  const claims = ctx.claims;
  if (!claims) return null;
  let best: number | null = null;
  let bestValue = 0;
  for (const continent of claims.setup.continents) {
    const byPlayer = claims.current.get(continent.id);
    const value =
      continent.bonus *
      (byPlayer?.get(ctx.botId) ?? 0) *
      (1 - strongestRival(ctx, byPlayer));
    if (value > bestValue) {
      bestValue = value;
      best = continent.id;
    }
  }
  return best;
}
