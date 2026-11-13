import { attackDiceFor } from '../../../game/combat/dice';
import { attackWinProbability } from '../../features/combat';
import { AttackChoice, attackOrder } from '../../heuristics/attack';
import {
  PlanContext,
  SimState,
  defenceDiceAt,
  hostileNeighborsOf,
  ownedIds,
  snapshotState,
  troopsIn,
  troopsPerDefenderAt,
} from '../../planning/context';
import {
  Candidate,
  StackPlan,
  multiDeployments,
  supplyConnected,
} from '../../planning/simulate';
import { Weights } from '../../types';
import { isVisible } from '../../view';

export const opportunistWeights: Weights = {
  completeContinent: 1,
  breakContinent: 1,
  eliminate: 1.5,
  stack: 0,
  grudge: 0.2,
  defendFrontier: 0.5,
  antiLeader: 0.5,
  defense: 0.5,
  holdChokepoint: 0.3,
  duelBreak: 1,
  duelStack: 0.5,
  duelRoll: 1,
  aggression: 1,
  keepStack: 0,
};

const MAX_SNIPE_STACKS = 8;

function isLoneTroop(ctx: PlanContext, state: SimState, id: number): boolean {
  return (
    state.owners.has(id) && isVisible(ctx.view, id) && troopsIn(state, id) === 1
  );
}

function loneTargets(
  ctx: PlanContext,
  state: SimState,
  fromId: number,
  claimed: Set<number>,
): number[] {
  return hostileNeighborsOf(ctx, state, fromId).filter(
    (id) => !claimed.has(id) && isLoneTroop(ctx, state, id),
  );
}

function snipeStacks(ctx: PlanContext, state: SimState): StackPlan[] {
  const claimed = new Set<number>();
  const starts = ownedIds(state, ctx.botId)
    .filter((id) => supplyConnected(ctx, id))
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a));
  const stacks: StackPlan[] = [];
  for (const startId of starts) {
    const route: number[] = [];
    let next = loneTargets(ctx, state, startId, claimed)[0];
    while (next !== undefined) {
      claimed.add(next);
      route.push(next);
      next = loneTargets(ctx, state, next, claimed)[0];
    }
    if (route.length > 0) stacks.push({ startId, route, objectiveIndex: 0 });
  }
  return stacks.sort((a, b) => b.route.length - a.route.length);
}

export function snipeCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  if (ctx.personality !== 'opportunist') return [];
  const stacks = snipeStacks(ctx, state).slice(0, MAX_SNIPE_STACKS);
  const stagingCosts = stacks.map((stack) => ({
    id: stack.startId,
    cost: stack.route.reduce(
      (sum, id) => sum + 1 + troopsPerDefenderAt(ctx, id),
      0,
    ),
  }));
  return stacks.map((_, index) => {
    const included = stacks.slice(0, index + 1);
    const costs = stagingCosts.slice(0, index + 1);
    return {
      objectives: [
        {
          kind: 'snipe',
          targetPlayerId: null,
          continentId: null,
          mustVisit: included.flatMap((stack) => stack.route),
        },
      ],
      deployments: multiDeployments(ctx, state, costs, budget),
      stacks: included,
      stagingCosts: costs,
    };
  });
}

export function chooseSnipe(
  ctx: PlanContext,
  drainsCapital: (startId: number, endId: number) => boolean,
): AttackChoice | null {
  if (ctx.personality !== 'opportunist') return null;
  const state = snapshotState(ctx);
  let best: AttackChoice | null = null;
  let bestWin = 0;
  for (const startId of ownedIds(state, ctx.botId)) {
    const attackers = troopsIn(state, startId) - 1;
    if (attackers < 1) continue;
    for (const endId of hostileNeighborsOf(ctx, state, startId)) {
      if (!isLoneTroop(ctx, state, endId) || drainsCapital(startId, endId))
        continue;
      const win = attackWinProbability(
        ctx.game,
        attackers,
        1,
        defenceDiceAt(ctx, endId),
        attackDiceFor(ctx.game, startId),
      );
      if (win <= bestWin) continue;
      bestWin = win;
      best = {
        startId,
        endId,
        ...attackOrder(ctx.game, attackers, attackDiceFor(ctx.game, startId)),
      };
    }
  }
  return best;
}
