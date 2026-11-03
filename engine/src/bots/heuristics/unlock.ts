import { defenceDiceFor } from '../../game/combat/dice';
import { closedTiles } from '../../game/tiles/unlock';
import { isFreeConquestTarget } from '../../game/toxins/toxins';
import { attackWinProbability } from '../features/combat';
import { expectedScore, StepRisk } from '../goals/failureRisk';
import { evaluateBoard } from '../planning/board';
import {
  attackersOf,
  cloneState,
  isEnemyTerritory,
  isFriendly,
  neighborsOf,
  ownedIds,
  PlanContext,
  snapshotState,
  strongestThreatAt,
  troopsIn,
} from '../planning/context';
import { walkStack } from '../planning/simulate';
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

  const cost = ctx.unlockCost;
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

function marginalIncome(ctx: PlanContext, ownedCount: number): number {
  const { minTroops, troopsPerTerritory } = ctx.game;
  return (
    Math.max(minTroops, (ownedCount + 1) * troopsPerTerritory) -
    Math.max(minTroops, ownedCount * troopsPerTerritory)
  );
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
  const cost = ctx.unlockCost;
  const ownedCount = ownedIds(state, ctx.botId).length;
  const expansionScore =
    marginalIncome(ctx, ownedCount) * EXPANSION_PAYBACK_TURNS - cost;
  let baseScore: number | undefined;
  const ownedBy = (id: number) => state.owners.get(id) === ctx.botId;
  const safe = (id: number) => {
    const ownerId = state.owners.get(id);
    return ownerId === undefined
      ? isVisible(ctx.view, id)
      : isFriendly(ctx, ownerId);
  };

  let bestBridge: (UnlockOpportunity & { score: number }) | null = null;
  let bestExpansion: (UnlockOpportunity & { score: number }) | null = null;
  const consider = (option: UnlockOpportunity & { score: number }) => {
    if (option.score <= 0) return;
    const best = option.occupy ? bestExpansion : bestBridge;
    if (best && best.score >= option.score) return;
    if (option.occupy) bestExpansion = option;
    else bestBridge = option;
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
          attackersOf(ctx, targetId).some(
            (id) => ownedBy(id) && troopsIn(state, id) >= troops - cost,
          )
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
        const after = cloneState(state);
        const steps: AttackStep[] = [];
        const risks: StepRisk[] = [];
        walkStack(
          ctx,
          after,
          { startId: fromId, route: [tile.id, targetId], objectiveIndex: -1 },
          steps,
          risks,
        );
        if (steps.length < 2) continue;
        consider({
          fromId,
          tileId: tile.id,
          steps: steps.slice(1),
          occupy: false,
          score:
            expectedScore(ctx, risks, evaluateBoard(ctx, after)) -
            (baseScore ??= evaluateBoard(ctx, state)),
        });
      }
    }
  }
  return bestBridge ?? bestExpansion;
}
