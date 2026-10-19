import { defenceDiceFor } from '../../game/combat/dice';
import { territoryIncome } from '../../game/mechanics';
import { nextSetBaseValues } from '../../game/progression/cards';
import { closedTiles, unlockCost } from '../../game/tiles/unlock';
import { isFreeConquestTarget } from '../../game/toxins/toxins';
import { attackWinProbability } from '../features/combat';
import { completesOrBreaksContinent } from '../goals/keepStack';
import {
  bonusOf,
  isEnemyTerritory,
  isFriendly,
  neighborsOf,
  ownedIds,
  PlanContext,
  SimState,
  snapshotState,
  strongestThreatAt,
  troopsIn,
} from '../planning/context';
import { AttackStep } from '../planning/turnPlan';
import { isVisible } from '../view';

const EXPANSION_PAYBACK_TURNS = 4;
const BRIDGE_MIN_WIN = 0.75;
const PLAN_DEPTH_PER_UNLOCK = 6;

export interface UnlockChoice {
  fromId: number;
  tileId: number;
}

export interface UnlockOpportunity extends UnlockChoice {
  steps: AttackStep[];
  occupy: boolean;
}

export function chooseUnlock(ctx: PlanContext): UnlockChoice | null {
  const { game } = ctx;
  const locked = closedTiles(game);
  if (locked.length === 0) return null;
  const owned = (id: number) => game.territoryOwners.get(id) === ctx.botId;
  const target = (id: number) => {
    if (!isVisible(ctx.view, id)) return true;
    const ownerId = game.territoryOwners.get(id);
    if (ownerId === undefined) return isFreeConquestTarget(game, id);
    return ownerId !== ctx.botId && !ctx.friendlyIds.has(ownerId);
  };
  const reachesTarget = ctx.map.territories.some(
    (t) => owned(t.id) && neighborsOf(ctx, t.id).some(target),
  );
  if (reachesTarget) return null;

  const lockedById = new Map(locked.map((tile) => [tile.id, tile]));
  const distance = new Map<number, number>();
  const queue: number[] = [];
  for (const tile of locked) {
    if (!tile.neighbors.some((n) => !lockedById.has(n) && target(n))) continue;
    distance.set(tile.id, 0);
    queue.push(tile.id);
  }
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    for (const n of lockedById.get(id)!.neighbors) {
      if (!lockedById.has(n) || distance.has(n)) continue;
      distance.set(n, distance.get(id)! + 1);
      queue.push(n);
    }
  }

  const cost = unlockCost(game, ctx.botId);
  let best: (UnlockChoice & { distance: number; troops: number }) | null = null;
  for (const tile of locked) {
    const tileDistance = distance.get(tile.id);
    if (tileDistance === undefined) continue;
    for (const fromId of tile.neighbors) {
      if (!owned(fromId)) continue;
      const troops = game.territoryTroops.get(fromId) ?? 0;
      if (troops < cost + 2) continue;
      if (
        best &&
        (tileDistance > best.distance ||
          (tileDistance === best.distance && troops <= best.troops))
      )
        continue;
      best = { fromId, tileId: tile.id, distance: tileDistance, troops };
    }
  }
  return best;
}

function bridgeValue(
  ctx: PlanContext,
  state: SimState,
  targetId: number,
): number {
  const ownerId = state.owners.get(targetId)!;
  let value = 0;
  if (ctx.game.cards !== 'off' && !state.conquered)
    value += nextSetBaseValues(ctx.game, ctx.botId).mixed / 3;
  if (ctx.preTurnOpponents.get(ownerId) === 1) value += ctx.income;
  if (completesOrBreaksContinent(ctx, state, targetId, ownerId))
    value += bonusOf(ctx, ctx.territoryContinent.get(targetId)!);
  return value;
}

export function chooseOpportunisticUnlock(
  ctx: PlanContext,
  unlocksIssued: number,
): UnlockOpportunity | null {
  if (
    unlocksIssued >= Math.ceil(ctx.params.maxPlanDepth / PLAN_DEPTH_PER_UNLOCK)
  )
    return null;
  const { game } = ctx;
  const locked = closedTiles(game);
  if (locked.length === 0) return null;
  const lockedIds = new Set(locked.map((tile) => tile.id));
  const state = snapshotState(ctx);
  const cost = unlockCost(game, ctx.botId);
  const ownedCount = ownedIds(state, ctx.botId).length;
  const expansionScore =
    (territoryIncome(game, ownedCount + 1) -
      territoryIncome(game, ownedCount)) *
      EXPANSION_PAYBACK_TURNS -
    cost;
  const ownedBy = (id: number) => state.owners.get(id) === ctx.botId;
  const safe = (id: number) => {
    const ownerId = state.owners.get(id);
    return ownerId === undefined
      ? isVisible(ctx.view, id)
      : isFriendly(ctx, ownerId);
  };

  let best: (UnlockOpportunity & { score: number }) | null = null;
  const consider = (option: UnlockOpportunity & { score: number }) => {
    if (option.score > 0 && (!best || option.score > best.score)) best = option;
  };
  for (const tile of locked) {
    const opened = tile.neighbors.filter((id) => !lockedIds.has(id));
    const unsafe = opened.filter((id) => !safe(id));
    for (const fromId of opened) {
      if (!ownedBy(fromId)) continue;
      const troops = troopsIn(state, fromId);
      if (troops < cost + 2) continue;
      const threat = strongestThreatAt(ctx, state, fromId);
      if (unsafe.length === 0) {
        if (troops - cost - 1 >= threat)
          consider({
            fromId,
            tileId: tile.id,
            steps: [],
            occupy: true,
            score: expansionScore,
          });
        continue;
      }
      if (threat > ctx.income) continue;
      for (const targetId of unsafe) {
        if (
          !isEnemyTerritory(ctx, state, targetId) ||
          !isVisible(ctx.view, targetId) ||
          neighborsOf(ctx, targetId).some(ownedBy)
        )
          continue;
        const others = unsafe.filter((id) => id !== targetId);
        if (others.some((id) => !isVisible(ctx.view, id))) continue;
        if (
          Math.max(0, ...others.map((id) => troopsIn(state, id))) > ctx.income
        )
          continue;
        const win = attackWinProbability(
          game,
          troops - cost - 2,
          troopsIn(state, targetId),
          defenceDiceFor(game, targetId),
        );
        if (win < BRIDGE_MIN_WIN) continue;
        consider({
          fromId,
          tileId: tile.id,
          steps: [
            {
              startId: tile.id,
              endId: targetId,
              objectiveIndex: -1,
              minWinProb: Math.max(0.3, win - 0.3),
            },
          ],
          occupy: false,
          score: win * bridgeValue(ctx, state, targetId) - cost,
        });
      }
    }
  }
  return best;
}
