import { isKeyTerritory } from '../features/territory';
import {
  PlanContext,
  SimState,
  attackersOf,
  bonusOf,
  holdsContinent,
  isEnemyTerritory,
  isFriendly,
  ownedIds,
  strongestThreatAt,
  troopsIn,
  troopsPerDefenderAt,
} from '../planning/context';

const STACK_ENTRENCH_MIN = 15;
const SIEGE_ENTRENCH_MIN = 6;
const THREAT_MARGIN = 1.2;
const BONUS_THREAT_MARGIN = 1.6;
const MIN_ATTACKING_THREAT = 2;
const FAR_THREAT_SHARE = 0.4;
const STACK_THREAT_SHARE = 0.5;
const SIEGE_TURNS = 2;
const PRIORITY_BOOST = 1000;

interface EntrenchMove {
  territoryId: number;
  troops: number;
}

function rivalCapitals(ctx: PlanContext, state: SimState): number[] {
  if (ctx.game.gameMode !== 'capitals') return [];
  return [...ctx.game.capitalTerritoryIds].filter((id) =>
    isEnemyTerritory(ctx, state, id),
  );
}

function siegeTerritories(ctx: PlanContext, state: SimState): Set<number> {
  const ids = new Set<number>();
  for (const capitalId of rivalCapitals(ctx, state))
    for (const id of attackersOf(ctx, capitalId))
      if (state.owners.get(id) === ctx.botId) ids.add(id);
  return ids;
}

function guardsBonus(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): boolean {
  const continentId = ctx.territoryContinent.get(territoryId);
  if (continentId === undefined || bonusOf(ctx, continentId) <= 0) return false;
  return holdsContinent(
    ctx,
    state,
    ctx.continentTerritories.get(continentId) ?? [],
    ctx.botId,
  );
}

interface EntrenchChoice {
  priority: number;
  troops: number;
}

function largestEnemyStack(ctx: PlanContext, state: SimState): number {
  let largest = 0;
  for (const [id, ownerId] of state.owners)
    if (!isFriendly(ctx, ownerId))
      largest = Math.max(largest, troopsIn(state, id));
  return largest;
}

function entrenchChoice(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
  siege: Set<number>,
  farThreat: number,
): EntrenchChoice | null {
  const adjacent = strongestThreatAt(ctx, state, territoryId);
  if (adjacent < MIN_ATTACKING_THREAT) return null;
  const threat = Math.max(adjacent, farThreat);
  const troops = troopsIn(state, territoryId);
  const besieging = siege.has(territoryId) && troops >= SIEGE_ENTRENCH_MIN;
  const stack =
    troops >= STACK_ENTRENCH_MIN && threat >= STACK_THREAT_SHARE * troops;
  const maxHold = (troops - 1) * ctx.entrenchWorth;
  const couldHold =
    threat * BONUS_THREAT_MARGIN > troops && threat * THREAT_MARGIN <= maxHold;
  if (!stack && !besieging && !couldHold) return null;
  const bonus = guardsBonus(ctx, state, territoryId);
  const needed = threat * (bonus ? BONUS_THREAT_MARGIN : THREAT_MARGIN);
  const holds = needed > troops && needed <= maxHold;
  if (!stack && !besieging && !holds) return null;
  const boosts = [bonus, isKeyTerritory(ctx.game, territoryId), besieging];
  return {
    priority: troops + PRIORITY_BOOST * boosts.filter(Boolean).length,
    troops: besieging ? SIEGE_TURNS : 1,
  };
}

export function entrenchMoves(
  ctx: PlanContext,
  state: SimState,
): EntrenchMove[] {
  if (ctx.game.entrenchments !== 'on') return [];
  const siege = siegeTerritories(ctx, state);
  const farThreat = FAR_THREAT_SHARE * largestEnemyStack(ctx, state);
  return ownedIds(state, ctx.botId)
    .filter(
      (id) =>
        !ctx.game.capitalTerritoryIds.has(id) &&
        !state.entrenched.has(id) &&
        troopsIn(state, id) >= 2,
    )
    .flatMap((id) => {
      const choice = entrenchChoice(ctx, state, id, siege, farThreat);
      return choice === null ? [] : [{ id, choice }];
    })
    .sort((a, b) => b.choice.priority - a.choice.priority)
    .slice(0, ctx.params.maxPlanDepth)
    .map((entry) => ({ territoryId: entry.id, troops: entry.choice.troops }));
}

export function applyEntrenchments(
  ctx: PlanContext,
  state: SimState,
): EntrenchMove[] {
  const moves = entrenchMoves(ctx, state);
  for (const { territoryId, troops } of moves) {
    state.troops.set(territoryId, troopsIn(state, territoryId) - troops);
    state.entrenched.add(territoryId);
  }
  return moves;
}

export function undoEntrenchments(
  state: SimState,
  moves: EntrenchMove[],
): void {
  for (const { territoryId, troops } of moves) {
    state.troops.set(territoryId, troopsIn(state, territoryId) + troops);
    state.entrenched.delete(territoryId);
  }
}

export function entrenchStackTargets(
  ctx: PlanContext,
  state: SimState,
): number[] {
  if (ctx.game.entrenchments !== 'on') return [];
  const owned = ownedIds(state, ctx.botId).filter(
    (id) => !ctx.game.capitalTerritoryIds.has(id),
  );
  const siege = siegeTerritories(ctx, state);
  const besieging = owned
    .filter((id) => siege.has(id))
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))[0];
  const deficit = (id: number) =>
    strongestThreatAt(ctx, state, id) - troopsIn(state, id);
  const guarding = owned
    .filter(
      (id) =>
        guardsBonus(ctx, state, id) &&
        strongestThreatAt(ctx, state, id) >= MIN_ATTACKING_THREAT,
    )
    .sort((a, b) => deficit(b) - deficit(a))[0];
  return [...new Set([besieging, guarding].filter((id) => id !== undefined))];
}

export function capitalPressure(ctx: PlanContext, state: SimState): number {
  if (ctx.game.entrenchments !== 'on') return 0;
  let total = 0;
  for (const capitalId of rivalCapitals(ctx, state)) {
    let stack = 0;
    for (const id of attackersOf(ctx, capitalId))
      if (state.owners.get(id) === ctx.botId)
        stack = Math.max(stack, troopsIn(state, id) - 1);
    if (stack === 0) continue;
    const garrison =
      1 + troopsIn(state, capitalId) * troopsPerDefenderAt(ctx, capitalId);
    const reach = Math.min(1, (stack + ctx.income) / garrison);
    total += reach * reach;
  }
  return total;
}
