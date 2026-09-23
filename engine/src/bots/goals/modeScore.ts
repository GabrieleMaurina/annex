import {
  ModeGoal,
  SideProgress,
  modeGoalFor,
  sideProgress,
  territoryCounts,
} from '../features/mode/modeGoals';
import { PlanContext, SimState } from '../planning/context';

const OWN_PROGRESS = 40;
const WIN = 80;
const THREAT = 60;
const THREAT_ONSET = 0.6;
const ROUND_BASE = 3;
const ROUND_GAIN = 5;
const ROUND_SPREAD = 0.03;
const ASSASSIN_WIN = 70;
const ASSASSIN_PROGRESS = 25;
const SELF_ELIMINATION = 30;

function curve(progress: number, onset: number): number {
  const x = Math.min(1, Math.max(0, (progress - onset) / (1 - onset)));
  return x * x * x;
}

function ownsAnything(ctx: PlanContext, state: SimState): boolean {
  for (const ownerId of state.owners.values())
    if (ownerId === ctx.botId) return true;
  return false;
}

function totalDamage(state: SimState): number {
  let total = 0;
  for (const damage of state.damageByPlayer.values()) total += damage;
  return total;
}

function roundRace(ctx: PlanContext, goal: ModeGoal, state: SimState): number {
  const counts = territoryCounts(ctx, goal, state);
  const own = counts.get(goal.ownSide) ?? 0;
  const spread = Math.max(2, goal.total * ROUND_SPREAD);
  let rivalsBeaten = 0;
  let leads = 1;
  for (const [side, count] of counts) {
    if (side === goal.ownSide) continue;
    rivalsBeaten += 1 / (1 + Math.exp((count - own) / spread));
    if (count >= own) leads = 0;
  }
  const urgency =
    ROUND_BASE + ROUND_GAIN * (1 - goal.turnsLeft / goal.roundLimit);
  return urgency * (rivalsBeaten + leads);
}

function assassinScore(
  ctx: PlanContext,
  goal: ModeGoal,
  state: SimState,
): number {
  let remaining = 0;
  for (const ownerId of state.owners.values())
    if (ownerId === goal.assassinId) remaining++;
  if (remaining === 0)
    return ctx.preTurnOpponents.has(goal.assassinId!) ? ASSASSIN_WIN : 0;
  const progress = Math.max(0, 1 - remaining / goal.assassinBase);
  return ASSASSIN_PROGRESS * progress * progress;
}

export function modeScore(
  ctx: PlanContext,
  state: SimState,
  cachedProgress?: SideProgress,
): number {
  const goal = modeGoalFor(ctx);
  let score = 0;
  if (!ownsAnything(ctx, state)) score -= SELF_ELIMINATION;
  if (goal.damageBonus > 0)
    score +=
      goal.damageBonus * totalDamage(state) +
      goal.lossRefund * state.troopsLost;
  if (!goal.active) return score;

  const { own, threats } = cachedProgress ?? sideProgress(ctx, goal, state);
  for (const progress of own)
    score +=
      progress >= 1 ? WIN : OWN_PROGRESS * goal.ownWeight * curve(progress, 0);
  for (const threat of threats)
    score -= THREAT * goal.threatWeight * curve(threat.progress, THREAT_ONSET);
  if (goal.roundLimit > 0) score += roundRace(ctx, goal, state);
  if (goal.assassinId !== null) score += assassinScore(ctx, goal, state);
  return score;
}
