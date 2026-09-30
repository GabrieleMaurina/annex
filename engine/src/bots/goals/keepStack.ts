import { stalematePressure } from '../features/pressure';
import { KEEP_STACK_TARGET, troopScale } from '../planning/board';
import {
  PlanContext,
  SimState,
  bonusOf,
  botBorderIds,
  defenceDiceAt,
  troopsIn,
} from '../planning/context';
import { keepStackWeight } from './stackOpenness';

const PROTECTED_SHARE = 0.5;

function keepSize(ctx: PlanContext, state: SimState): number {
  return (
    KEEP_STACK_TARGET *
    Math.min(1, keepStackWeight(ctx)) *
    troopScale(state) *
    (1 - stalematePressure(ctx.game))
  );
}

function completesOrBreaksContinent(
  ctx: PlanContext,
  state: SimState,
  endId: number,
  ownerId: number | undefined,
): boolean {
  const continentId = ctx.territoryContinent.get(endId);
  if (continentId === undefined || bonusOf(ctx, continentId) <= 0) return false;
  const territoryIds = ctx.continentTerritories.get(continentId) ?? [];
  return (
    territoryIds.every(
      (id) => id === endId || state.owners.get(id) === ctx.botId,
    ) ||
    (ownerId !== undefined &&
      territoryIds.every((id) => state.owners.get(id) === ownerId))
  );
}

function earnsSomething(
  ctx: PlanContext,
  state: SimState,
  endId: number,
): boolean {
  if (ctx.game.cards !== 'Off' && !ctx.game.conqueredThisTurn) return true;
  const ownerId = state.owners.get(endId);
  if (ownerId !== undefined && ctx.preTurnOpponents.get(ownerId) === 1)
    return true;
  return completesOrBreaksContinent(ctx, state, endId, ownerId);
}

export function breaksMainStack(
  ctx: PlanContext,
  state: SimState,
  startId: number,
  endId: number,
): boolean {
  if (ctx.finisher) return false;
  const keep = keepSize(ctx, state);
  const troops = troopsIn(state, startId);
  if (keep <= 0 || troops < keep * PROTECTED_SHARE) return false;
  if (botBorderIds(ctx, state).some((id) => troopsIn(state, id) > troops))
    return false;
  const losses =
    troopsIn(state, endId) * (defenceDiceAt(ctx, endId) === 3 ? 1.4 : 0.95);
  return troops - losses < keep && !earnsSomething(ctx, state, endId);
}
