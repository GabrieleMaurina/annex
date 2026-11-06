import { isFreeConquestTarget } from '../../game/toxins/toxins';
import { toggleFlipped } from '../../game/world/switches';
import {
  FLIP_COST,
  switchedLinkStates,
  switchStates,
} from '../../maps/switches';
import { attackWinProbability } from '../features/combat';
import { expectedScore, StepRisk } from '../goals/failureRisk';
import { evaluateBoard } from '../planning/board';
import {
  cloneState,
  defenceDiceAt,
  isEnemyTerritory,
  neighborsOf,
  ownedIds,
  PlanContext,
  SimState,
  snapshotState,
  troopsIn,
  withFlippedSwitch,
} from '../planning/context';
import { buildTurnPlan } from '../planning/enumerate';
import type { BotAction } from '../planning/planBotTurn';
import { walkStack } from '../planning/simulate';
import { AttackStep, TurnPlan } from '../planning/turnPlan';
import { isVisible } from '../view';

const MAX_FLIPS_PER_TURN = 2;
const KEPT_TROOPS = 2;
const NEW_TARGET_MIN_WIN = 0.75;

interface SwitchFlip {
  switchId: number;
  fromId: number;
  score: number;
}

function changesLinks(ctx: PlanContext, flippedIds: Set<number>): boolean {
  const { switches, switchedLinks } = ctx.map;
  const before = switchedLinkStates(
    switchedLinks,
    switchStates(switches, ctx.game.flippedSwitchIds),
  );
  const after = switchedLinkStates(
    switchedLinks,
    switchStates(switches, flippedIds),
  );
  return [...before].some(([key, on]) => after.get(key) !== on);
}

function isTarget(ctx: PlanContext, state: SimState, id: number): boolean {
  if (!isVisible(ctx.view, id)) return false;
  if (!state.owners.has(id)) return isFreeConquestTarget(ctx.game, id);
  return isEnemyTerritory(ctx, state, id);
}

function newTargets(
  ctx: PlanContext,
  next: PlanContext,
  state: SimState,
): [number, number][] {
  const owned = ownedIds(state, ctx.botId);
  const reachable = new Set(owned.flatMap((id) => neighborsOf(ctx, id)));
  return owned.flatMap((fromId) =>
    neighborsOf(next, fromId)
      .filter((id) => !reachable.has(id) && isTarget(ctx, state, id))
      .map((id): [number, number] => [fromId, id]),
  );
}

function conquestGain(
  next: PlanContext,
  state: SimState,
  base: number,
  fromId: number,
  targetId: number,
): number {
  const { game } = next;
  const win = attackWinProbability(
    game,
    troopsIn(state, fromId) - 1,
    troopsIn(state, targetId),
    defenceDiceAt(next, targetId),
  );
  if (win < NEW_TARGET_MIN_WIN) return -Infinity;
  const after = cloneState(state);
  const steps: AttackStep[] = [];
  const risks: StepRisk[] = [];
  walkStack(
    next,
    after,
    { startId: fromId, route: [targetId], objectiveIndex: -1 },
    steps,
    risks,
  );
  if (steps.length === 0) return -Infinity;
  return expectedScore(next, risks, evaluateBoard(next, after)) - base;
}

function flipScore(
  ctx: PlanContext,
  state: SimState,
  base: number,
  switchId: number,
  fromId: number,
): number {
  const flippedIds = new Set(ctx.game.flippedSwitchIds);
  toggleFlipped(flippedIds, switchId);
  if (!changesLinks(ctx, flippedIds)) return -Infinity;
  const next = withFlippedSwitch(ctx, flippedIds);
  const after = cloneState(state);
  after.troops.set(fromId, troopsIn(after, fromId) - FLIP_COST);
  after.troopsLost += FLIP_COST;
  return Math.max(
    evaluateBoard(next, after) - base,
    ...newTargets(ctx, next, after).map(([from, target]) =>
      conquestGain(next, after, base, from, target),
    ),
  );
}

function chooseSwitchFlip(ctx: PlanContext): SwitchFlip | null {
  const { switches } = ctx.map;
  if (switches.length === 0) return null;
  const state = snapshotState(ctx);
  const base = evaluateBoard(ctx, state);
  let best: SwitchFlip | null = null;
  for (let switchId = 0; switchId < switches.length; switchId++) {
    const fromId = switches[switchId].neighbors
      .filter(
        (id) =>
          state.owners.get(id) === ctx.botId &&
          troopsIn(state, id) >= FLIP_COST + KEPT_TROOPS,
      )
      .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))[0];
    if (fromId === undefined) continue;
    const score = flipScore(ctx, state, base, switchId, fromId);
    if (score > 0 && (!best || score > best.score))
      best = { switchId, fromId, score };
  }
  return best;
}

export function planSwitchFlip(
  ctx: PlanContext,
  plan: TurnPlan,
): BotAction[] | null {
  if (plan.switchReplan) {
    plan.switchReplan = false;
    const fresh = buildTurnPlan(ctx, 0, false);
    plan.objectives = fresh.objectives;
    plan.attackSteps = [
      ...plan.attackSteps.slice(0, plan.step),
      ...fresh.attackSteps,
    ];
    plan.fortify = fresh.fortify;
    plan.topology = fresh.topology;
  }
  const checkpoint = plan.step === 0 || plan.step >= plan.attackSteps.length;
  if (
    !checkpoint ||
    plan.switchCheckedStep === plan.step ||
    (plan.switchFlips ?? 0) >= MAX_FLIPS_PER_TURN
  )
    return null;
  plan.switchCheckedStep = plan.step;
  const flip = chooseSwitchFlip(ctx);
  if (!flip) return null;
  plan.switchFlips = (plan.switchFlips ?? 0) + 1;
  plan.switchReplan = true;
  plan.switchCheckedStep = undefined;
  return [
    { event: 'game:attackSelectStart', payload: { territoryId: flip.fromId } },
    { event: 'game:flipSwitch', payload: { switchId: flip.switchId } },
  ];
}
