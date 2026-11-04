import { attackWinProbability } from '../../features/combat';
import { continentBreakCandidates } from '../../features/continents';
import { minWinProbability } from '../../features/pressure';
import { targetPreference } from '../../features/standing';
import {
  PlanContext,
  SimState,
  attackersOf,
  defenceDiceAt,
  hostileNeighborsOf,
  isFriendly,
  ownedIds,
  snapshotState,
  troopsIn,
} from '../../planning/context';
import { routeStack } from '../../planning/route';
import {
  Candidate,
  StackPlan,
  multiDeployments,
  pickStaging,
  stackCandidates,
} from '../../planning/simulate';
import { Objective } from '../../planning/turnPlan';
import { Weights } from '../../types';

export const policeWeights: Weights = {
  completeContinent: 0.3,
  breakContinent: 6,
  eliminate: 0.5,
  stack: 0.5,
  grudge: 0.2,
  defendFrontier: 0.7,
  antiLeader: 0.5,
  defense: 0.7,
  holdChokepoint: 0.3,
  duelBreak: 12,
  duelStack: 1,
  duelRoll: 0.5,
  aggression: 2,
  keepStack: 0.2,
};

export const policeStrongestPreference = 2;

const MAX_BREAKS = 6;
const MAX_PURSUIT_TARGETS = 3;

interface BreakGroup {
  objective: Objective;
  stack: StackPlan;
  cost: number;
}

function breakGroups(ctx: PlanContext, state: SimState): BreakGroup[] {
  const byStaging = new Map<number, { ownerId: number; targetId: number }[]>();
  continentBreakCandidates(ctx.game, ctx.view, ctx.botId)
    .filter((c) => !isFriendly(ctx, c.ownerId))
    .sort(
      (a, b) =>
        targetPreference(ctx.standing, b.ownerId) -
          targetPreference(ctx.standing, a.ownerId) || b.bonus - a.bonus,
    )
    .slice(0, MAX_BREAKS)
    .forEach((c) => {
      const targetId = c.weakestTerritoryId;
      const staging = pickStaging(ctx, state, new Set([targetId]));
      if (
        staging === null ||
        routeStack(ctx, state, staging, [targetId], null).path.length === 0
      )
        return;
      const group = byStaging.get(staging) ?? [];
      group.push({ ownerId: c.ownerId, targetId });
      byStaging.set(staging, group);
    });

  const groups: BreakGroup[] = [];
  for (const [staging, targets] of byStaging) {
    const mustVisit = targets.map((t) => t.targetId);
    const route = routeStack(ctx, state, staging, mustVisit, null);
    if (route.path.length === 0) continue;
    groups.push({
      objective: {
        kind: 'break',
        targetPlayerId: targets[0].ownerId,
        continentId: null,
        mustVisit,
      },
      stack: { startId: staging, route: route.path, objectiveIndex: 0 },
      cost: route.cost,
    });
  }
  return groups;
}

function preferenceOf(ctx: PlanContext, state: SimState, id: number): number {
  return targetPreference(ctx.standing, state.owners.get(id));
}

function isBreak(candidate: Candidate): boolean {
  return candidate.objectives.some((objective) => objective.kind === 'break');
}

function weakestVictim(
  ctx: PlanContext,
  state: SimState,
  candidate: Candidate,
): number {
  let weakest = Infinity;
  for (const stack of candidate.stacks)
    for (const id of stack.route) {
      const ownerId = state.owners.get(id);
      if (ownerId === undefined || isFriendly(ctx, ownerId)) continue;
      weakest = Math.min(weakest, preferenceOf(ctx, state, id));
    }
  return weakest;
}

export function policeChoice<T extends { candidate: Candidate }>(
  ctx: PlanContext,
  state: SimState,
  entries: T[],
  viable: (entry: T) => boolean,
): T[] {
  if (ctx.personality !== 'police') return entries;
  let top = -Infinity;
  for (const entry of entries) {
    if (!viable(entry) || isBreak(entry.candidate)) continue;
    const victim = weakestVictim(ctx, state, entry.candidate);
    if (victim !== Infinity) top = Math.max(top, victim);
  }
  if (top === -Infinity) return entries;
  return entries.filter(
    (entry) =>
      isBreak(entry.candidate) ||
      weakestVictim(ctx, state, entry.candidate) >= top,
  );
}

export function policeOutranked(
  ctx: PlanContext,
): (territoryId: number) => boolean {
  if (ctx.personality !== 'police') return () => false;
  const state = snapshotState(ctx);
  const minWin = minWinProbability(ctx.game);
  let top = -Infinity;
  for (const startId of ownedIds(state, ctx.botId)) {
    const attackers = troopsIn(state, startId) - 1;
    if (attackers < 1) continue;
    for (const endId of hostileNeighborsOf(ctx, state, startId)) {
      if (!state.owners.has(endId)) continue;
      const win = attackWinProbability(
        ctx.game,
        attackers,
        troopsIn(state, endId),
        defenceDiceAt(ctx, endId),
      );
      if (win >= minWin) top = Math.max(top, preferenceOf(ctx, state, endId));
    }
  }
  return (territoryId) =>
    state.owners.has(territoryId) &&
    preferenceOf(ctx, state, territoryId) < top;
}

function pursuitCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const reachable = [...state.owners]
    .filter(
      ([id, ownerId]) =>
        !isFriendly(ctx, ownerId) &&
        attackersOf(ctx, id).some((n) => state.owners.get(n) === ctx.botId),
    )
    .map(([id]) => id);
  if (reachable.length === 0) return [];
  const top = Math.max(...reachable.map((id) => preferenceOf(ctx, state, id)));
  const targets = reachable
    .filter((id) => preferenceOf(ctx, state, id) === top)
    .sort((a, b) => troopsIn(state, a) - troopsIn(state, b))
    .slice(0, MAX_PURSUIT_TARGETS);
  return targets.flatMap((_, index) =>
    stackCandidates(
      ctx,
      state,
      {
        kind: index === 0 ? 'card' : 'prey',
        targetPlayerId: state.owners.get(targets[0]) ?? null,
        continentId: null,
        mustVisit: targets.slice(0, index + 1),
      },
      budget,
    ),
  );
}

export function policeCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  if (ctx.personality !== 'police') return [];
  const groups = breakGroups(ctx, state).slice(0, ctx.params.maxCampaigns);
  const breaks = groups.map((_, index) => {
    const included = groups.slice(0, index + 1);
    const stagingCosts = included.map((g) => ({
      id: g.stack.startId,
      cost: g.cost,
    }));
    return {
      objectives: included.map((g) => g.objective),
      deployments: multiDeployments(ctx, state, stagingCosts, budget),
      stacks: included.map((g, objectiveIndex) => ({
        ...g.stack,
        objectiveIndex,
      })),
      stagingCosts,
    };
  });
  return [...breaks, ...pursuitCandidates(ctx, state, budget)];
}
