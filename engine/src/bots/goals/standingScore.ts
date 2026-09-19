import { targetPreference } from '../features/standing';
import { PlanContext, SimState } from '../planning/context';

const STANDING = 0.2;
const CONQUEST_TROOPS = 3;
const STRONG_TARGET_DISCOUNT = 0.5;
const MAX_VICTIM_VALUE = 30;

export function standingScore(ctx: PlanContext, state: SimState): number {
  let score = 0;
  for (const [victimId, damage] of state.damageByPlayer) {
    const preference = targetPreference(ctx.standing, victimId);
    if (preference === 0) continue;
    const conquests = state.conquestsByPlayer.get(victimId) ?? 0;
    const weight =
      preference > 0 ? preference : preference * STRONG_TARGET_DISCOUNT;
    const value = Math.min(
      damage + CONQUEST_TROOPS * conquests,
      MAX_VICTIM_VALUE,
    );
    score += STANDING * weight * value;
  }
  return score;
}
