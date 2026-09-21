import {
  ModeGoal,
  Threat,
  modeGoalFor,
  sideOf,
  sideProgress,
} from '../features/modeGoals';
import {
  PlanContext,
  SimState,
  botBorderIds,
  defenceDiceAt,
  hostileNeighborsOf,
  isFriendly,
  isHazard,
  neighborsOf,
  ownedIds,
  troopsIn,
} from '../planning/context';
import {
  Candidate,
  defensiveDeployments,
  stackCandidates,
  supplyConnected,
} from '../planning/simulate';
import { Deployment, Objective, ObjectiveKind } from '../planning/turnPlan';
import { isVisible } from '../view';

const MAX_HOPS = 3;
const MAX_TARGETS = 4;
const MAX_EXPAND_BORDER_SCAN = 30;
const MAX_ASSASSIN_TARGETS = 8;
const MAX_THREATS = 2;
const THREAT_PROGRESS = 0.75;
const DENY_TARGETS = 3;

function objective(
  kind: ObjectiveKind,
  state: SimState,
  mustVisit: number[],
  continentId: number | null = null,
): Objective {
  return {
    kind,
    targetPlayerId: state.owners.get(mustVisit[0]) ?? null,
    continentId,
    mustVisit,
  };
}

function nearestTargets(
  ctx: PlanContext,
  state: SimState,
  wanted: Set<number>,
  limit: number,
): number[] {
  const found: number[] = [];
  const seen = new Set<number>();
  let frontier = ownedIds(state, ctx.botId);
  for (const id of frontier) seen.add(id);
  for (
    let hop = 0;
    hop < MAX_HOPS && frontier.length > 0 && found.length < limit;
    hop++
  ) {
    const next: number[] = [];
    const level: number[] = [];
    for (const id of frontier) {
      for (const n of neighborsOf(ctx, id)) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (!isVisible(ctx.view, n) || isHazard(ctx, n)) continue;
        const ownerId = state.owners.get(n);
        if (ownerId !== undefined && isFriendly(ctx, ownerId)) continue;
        if (wanted.has(n)) level.push(n);
        next.push(n);
      }
    }
    level.sort((a, b) => troopsIn(state, a) - troopsIn(state, b));
    found.push(...level);
    frontier = next;
  }
  return found.slice(0, limit);
}

function campaigns(
  ctx: PlanContext,
  state: SimState,
  budget: number,
  kind: ObjectiveKind,
  targets: number[],
  continentId: number | null = null,
): Candidate[] {
  if (targets.length === 0) return [];
  const groups =
    targets.length > 1 ? [targets.slice(0, 1), targets] : [targets];
  return groups.flatMap((mustVisit) =>
    stackCandidates(
      ctx,
      state,
      objective(kind, state, mustVisit, continentId),
      budget,
    ),
  );
}

function assassinCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
  goal: ModeGoal,
): Candidate[] {
  if (goal.assassinId === null) return [];
  const owned = ownedIds(state, goal.assassinId);
  if (owned.length === 0) return [];
  const wanted = new Set(owned);
  const targets =
    owned.length <= MAX_ASSASSIN_TARGETS
      ? nearestTargets(ctx, state, wanted, owned.length)
      : nearestTargets(ctx, state, wanted, MAX_TARGETS);
  return campaigns(ctx, state, budget, 'eliminate', targets);
}

function holdCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
  goal: ModeGoal,
): Candidate[] {
  if (goal.holdIds.length === 0) return [];
  const wanted = new Set(
    goal.holdIds.filter((id) => {
      const ownerId = state.owners.get(id);
      return ownerId !== ctx.botId && !(ownerId && isFriendly(ctx, ownerId));
    }),
  );
  const targets = nearestTargets(ctx, state, wanted, MAX_TARGETS);
  return campaigns(
    ctx,
    state,
    budget,
    'capture',
    targets,
    ctx.game.continentId,
  );
}

function denyCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
  goal: ModeGoal,
  threats: Threat[],
): Candidate[] {
  return threats
    .filter((threat) => threat.progress >= THREAT_PROGRESS)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, MAX_THREATS)
    .flatMap((threat) => {
      const wanted = new Set<number>();
      for (const [id, ownerId] of state.owners) {
        if (sideOf(goal, ownerId) !== threat.side) continue;
        if (threat.hold && !goal.holdSet.has(id)) continue;
        wanted.add(id);
      }
      const targets = nearestTargets(ctx, state, wanted, DENY_TARGETS);
      return campaigns(ctx, state, budget, 'deny', targets);
    });
}

function expandCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
  goal: ModeGoal,
): Candidate[] {
  if (!goal.expand) return [];
  const costs = new Map<number, number>();
  for (const border of botBorderIds(ctx, state).slice(
    0,
    MAX_EXPAND_BORDER_SCAN,
  ))
    for (const n of hostileNeighborsOf(ctx, state, border))
      if (!costs.has(n))
        costs.set(
          n,
          troopsIn(state, n) * (defenceDiceAt(ctx, n) === 3 ? 1.4 : 0.95),
        );
  const targets = [...costs.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, MAX_TARGETS)
    .map(([id]) => id);
  if (targets.length === 0) return [];
  return stackCandidates(
    ctx,
    state,
    objective('expand', state, targets),
    budget,
  );
}

function garrisonCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
  goal: ModeGoal,
): Candidate[] {
  if (goal.minTroops <= 1 || goal.threshold <= 0 || budget <= 0) return [];
  const owned = ownedIds(state, ctx.botId);
  const short = owned.filter((id) => troopsIn(state, id) < goal.minTroops);
  const missing = goal.threshold - (owned.length - short.length);
  if (missing <= 0 || owned.length < goal.threshold) return [];

  const deployments: Deployment[] = [];
  let spent = 0;
  for (const id of short) {
    if (deployments.length >= missing || !supplyConnected(ctx, id)) continue;
    const troops = goal.minTroops - troopsIn(state, id);
    if (spent + troops > budget) break;
    deployments.push({ territoryId: id, troops });
    spent += troops;
  }
  if (deployments.length === 0) return [];
  return [
    {
      objectives: [objective('expand', state, [])],
      deployments: [
        ...deployments,
        ...defensiveDeployments(ctx, state, budget - spent),
      ],
      stacks: [],
    },
  ];
}

export function modeCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const goal = modeGoalFor(ctx);
  if (!goal.active) return [];
  const { threats } = sideProgress(ctx, goal, state);
  return [
    ...assassinCandidates(ctx, state, budget, goal),
    ...holdCandidates(ctx, state, budget, goal),
    ...denyCandidates(ctx, state, budget, goal, threats),
    ...expandCandidates(ctx, state, budget, goal),
    ...garrisonCandidates(ctx, state, budget, goal),
  ];
}
