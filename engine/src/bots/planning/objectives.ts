import {
  continentBreakCandidates,
  continentCompletionCandidates,
} from '../features/continents';
import { modeGoalFor } from '../features/modeGoals';
import { navalOpportunities, seaBridgeTargets } from '../features/navy';
import { stalematePressure } from '../features/pressure';
import { antiLeaderActive } from '../features/standing';
import { modeCandidates } from '../goals/modeObjectives';
import { preyCandidates } from '../goals/preyObjectives';
import { killerWeaknessThreshold } from '../personality/killer';
import {
  PlanContext,
  SimState,
  botBorderIds,
  conquerablePath,
  defenceDiceAt,
  frontierStacks,
  hostileNeighborsOf,
  isFriendly,
  neighborsOf,
  ownedChokepoints,
  ownedClusters,
  ownedIds,
  rankedOpponents,
  troopsIn,
} from './context';
import { routeStack } from './route';
import {
  Candidate,
  defensiveDeployments,
  offensiveDeployments,
  pickStaging,
  stackCandidates,
  supplyConnected,
} from './simulate';
import { Objective } from './turnPlan';

const DEFAULT_WEAKNESS_THRESHOLD = 0.15;
const MAX_ELIMINATE_TARGETS = 2;
const PASSIVE_RELEASE_PRESSURE = 0.6;
const MAX_ELIMINATE_MUST_VISIT = 12;
const MAX_DUEL_ELIMINATE_MUST_VISIT = 40;
const DUEL_PLAYER_COUNT = 2;

export function eliminateMustVisitLimit(state: SimState): number {
  return new Set(state.owners.values()).size <= DUEL_PLAYER_COUNT
    ? MAX_DUEL_ELIMINATE_MUST_VISIT
    : MAX_ELIMINATE_MUST_VISIT;
}

function objective(
  fields: Partial<Objective> & { kind: Objective['kind'] },
): Objective {
  return {
    targetPlayerId: null,
    continentId: null,
    mustVisit: [],
    ...fields,
  };
}

function completeCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  return continentCompletionCandidates(ctx.game, ctx.view, ctx.botId).flatMap(
    (c) =>
      stackCandidates(
        ctx,
        state,
        objective({
          kind: 'complete',
          continentId: c.continentId,
          mustVisit: c.remainingTerritoryIds,
        }),
        budget,
      ),
  );
}

function breakCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  return continentBreakCandidates(ctx.game, ctx.view, ctx.botId).flatMap((c) =>
    stackCandidates(
      ctx,
      state,
      objective({
        kind: 'break',
        targetPlayerId: c.ownerId,
        continentId: c.continentId,
        mustVisit: [c.weakestTerritoryId],
      }),
      budget,
    ),
  );
}

function eliminationTargets(
  ctx: PlanContext,
  state: SimState,
  ids: number[],
): number[] {
  const limit = eliminateMustVisitLimit(state);
  if (ids.length <= limit) return ids;
  const touchesBot = (id: number) =>
    neighborsOf(ctx, id).some((n) => state.owners.get(n) === ctx.botId);
  return [...ids]
    .sort(
      (a, b) =>
        Number(!touchesBot(a)) - Number(!touchesBot(b)) ||
        troopsIn(state, a) - troopsIn(state, b),
    )
    .slice(0, limit);
}

function eliminateCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const totalTerritories = state.owners.size || 1;
  const threshold = Math.max(
    ctx.personality === 'killer'
      ? killerWeaknessThreshold
      : DEFAULT_WEAKNESS_THRESHOLD,
    modeGoalFor(ctx).eliminateThreshold,
    stalematePressure(ctx.game),
  );
  const byPlayer = new Map<number, number[]>();
  for (const [id, ownerId] of state.owners) {
    if (isFriendly(ctx, ownerId)) continue;
    const list = byPlayer.get(ownerId);
    if (list) list.push(id);
    else byPlayer.set(ownerId, [id]);
  }
  return [...byPlayer.entries()]
    .filter(([, ids]) => ids.length / totalTerritories <= threshold)
    .sort((a, b) => a[1].length - b[1].length)
    .slice(0, MAX_ELIMINATE_TARGETS)
    .flatMap(([playerId, ids]) =>
      stackCandidates(
        ctx,
        state,
        objective({
          kind: 'eliminate',
          targetPlayerId: playerId,
          mustVisit: eliminationTargets(ctx, state, ids),
        }),
        budget,
      ),
    );
}

function cardCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  let bestTarget: number | null = null;
  let bestFrom: number | null = null;
  let bestDefenders = Infinity;
  for (const from of ownedIds(state, ctx.botId)) {
    if (troopsIn(state, from) < 3 || !supplyConnected(ctx, from)) continue;
    for (const to of hostileNeighborsOf(ctx, state, from)) {
      const defenders = troopsIn(state, to);
      if (defenders < bestDefenders) {
        bestDefenders = defenders;
        bestTarget = to;
        bestFrom = from;
      }
    }
  }
  if (bestTarget === null || bestFrom === null) return [];
  const perDefender = defenceDiceAt(ctx, bestTarget) === 3 ? 1.4 : 0.95;
  const cost = 1 + bestDefenders * perDefender;
  return [
    {
      objectives: [
        objective({
          kind: 'card',
          targetPlayerId: state.owners.get(bestTarget) ?? null,
          mustVisit: [bestTarget],
        }),
      ],
      deployments: offensiveDeployments(ctx, state, bestFrom, budget, cost),
      stacks: [{ startId: bestFrom, route: [bestTarget], objectiveIndex: 0 }],
    },
  ];
}

function siegeStaging(ctx: PlanContext, state: SimState): number | null {
  const border = botBorderIds(ctx, state)
    .filter(
      (id) =>
        hostileNeighborsOf(ctx, state, id).length > 0 &&
        supplyConnected(ctx, id),
    )
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))[0];
  if (border !== undefined) return border;
  const bridgehead = [
    ...seaBridgeTargets(ctx.game, ctx.view, ctx.botId),
    ...navalOpportunities(ctx.game, ctx.view, ctx.botId),
  ].sort(
    (a, b) => troopsIn(state, a.targetId) - troopsIn(state, b.targetId),
  )[0];
  return bridgehead?.sourceTerritoryId ?? null;
}

function defensiveCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const objectives = [objective({ kind: 'defensive' })];
  const staging =
    stalematePressure(ctx.game) > 0 ? siegeStaging(ctx, state) : null;
  if (staging === null)
    return [
      {
        objectives,
        deployments: defensiveDeployments(ctx, state, budget),
        stacks: [],
      },
    ];
  return [
    {
      objectives,
      deployments: budget > 0 ? [{ territoryId: staging, troops: budget }] : [],
      stacks: [],
      fortifyHint: staging,
      siege: true,
    },
  ];
}

function mergeCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const stacks = frontierStacks(ctx, state, 4).slice(0, 5);
  const clusters = ownedClusters(ctx, state);
  const clusterOf = new Map<number, number>();
  clusters.forEach((cluster, index) =>
    cluster.forEach((id) => clusterOf.set(id, index)),
  );

  const candidates: Candidate[] = [];
  for (let i = 0; i < stacks.length; i++) {
    for (let j = i + 1; j < stacks.length; j++) {
      const a = stacks[i];
      const b = stacks[j];
      if (clusterOf.get(a) === clusterOf.get(b)) continue;
      const path = conquerablePath(ctx, state, a, b, 3);
      if (!path || path.length === 0) continue;
      const stronger = troopsIn(state, a) >= troopsIn(state, b) ? a : b;
      candidates.push(
        ...stackCandidates(
          ctx,
          state,
          objective({ kind: 'merge', mustVisit: path, fortifyHint: stronger }),
          budget,
          stronger,
        ),
      );
    }
  }
  return candidates;
}

function shrinkBorderCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const targets = new Set<number>();
  for (const border of botBorderIds(ctx, state)) {
    for (const n of hostileNeighborsOf(ctx, state, border)) {
      const foreign = neighborsOf(ctx, n).filter(
        (m) => state.owners.get(m) !== ctx.botId,
      ).length;
      if (foreign === 0) targets.add(n);
    }
  }
  if (targets.size === 0) return [];
  return stackCandidates(
    ctx,
    state,
    objective({
      kind: 'shrinkBorder',
      mustVisit: [...targets].slice(0, 4),
    }),
    budget,
  );
}

function holdChokepointCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  if (
    stalematePressure(ctx.game) >= PASSIVE_RELEASE_PRESSURE &&
    siegeStaging(ctx, state) !== null
  )
    return [];
  const chokes = ownedChokepoints(ctx, state).filter((id) =>
    supplyConnected(ctx, id),
  );
  return chokes.slice(0, 2).map((choke) => ({
    objectives: [
      objective({ kind: 'holdChokepoint', mustVisit: [], fortifyHint: choke }),
    ],
    deployments:
      budget > 0
        ? [{ territoryId: choke, troops: budget }]
        : defensiveDeployments(ctx, state, budget),
    stacks: [],
    fortifyHint: choke,
  }));
}

function neutralizeThreatCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const scored: {
    threat: number;
    target: number;
    border: number;
    staging: number;
    stagingTroops: number;
  }[] = [];
  for (const border of botBorderIds(ctx, state)) {
    for (const enemy of hostileNeighborsOf(ctx, state, border)) {
      if (state.owners.get(enemy) === undefined) continue;
      const enemyTroops = troopsIn(state, enemy);
      const threat = enemyTroops - troopsIn(state, border);
      if (threat < 2) continue;
      let bestStaging = -1;
      let bestStagingTroops = 0;
      for (const n of neighborsOf(ctx, enemy)) {
        if (state.owners.get(n) !== ctx.botId) continue;
        const t = troopsIn(state, n);
        if (t > bestStagingTroops) {
          bestStagingTroops = t;
          bestStaging = n;
        }
      }
      scored.push({
        threat,
        target: enemy,
        border,
        staging: bestStaging,
        stagingTroops: bestStagingTroops,
      });
    }
  }
  scored.sort((a, b) => b.threat - a.threat);
  const seen = new Set<number>();
  const candidates: Candidate[] = [];
  for (const entry of scored.slice(0, 3)) {
    if (seen.has(entry.target)) continue;
    seen.add(entry.target);
    const enemyTroops = troopsIn(state, entry.target);
    const canAttack =
      entry.staging >= 0 &&
      entry.stagingTroops - 1 + budget * 0.6 >= enemyTroops * 0.6;
    if (!canAttack) continue;
    candidates.push(
      ...stackCandidates(
        ctx,
        state,
        objective({
          kind: 'neutralizeThreat',
          targetPlayerId: state.owners.get(entry.target) ?? null,
          mustVisit: [entry.target],
          fortifyHint: entry.target,
        }),
        budget,
        entry.staging,
      ),
    );
  }
  return candidates;
}

function antiLeaderCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  if (!antiLeaderActive(ctx.standing)) return [];
  const ranked = rankedOpponents(ctx, state);
  if (ranked.length === 0) return [];
  const leader = ranked[0];
  const second = ranked[1]?.strength ?? 0;
  if (leader.strength < second * 1.25 + 1) return [];

  const reachable = ownedIds(state, leader.playerId).filter((id) =>
    neighborsOf(ctx, id).some((n) => state.owners.get(n) === ctx.botId),
  );
  if (reachable.length === 0) return [];
  const targets = reachable
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))
    .slice(0, 3);
  return stackCandidates(
    ctx,
    state,
    objective({
      kind: 'antiLeader',
      targetPlayerId: leader.playerId,
      mustVisit: targets,
    }),
    budget,
  );
}

function spoilContinentCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    const counts = new Map<number, number>();
    for (const id of territoryIds) {
      const owner = state.owners.get(id);
      if (owner !== undefined) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    for (const [owner, count] of counts) {
      if (isFriendly(ctx, owner)) continue;
      if (
        territoryIds.length < 3 ||
        count === territoryIds.length ||
        count < territoryIds.length - 2 ||
        count < territoryIds.length * 0.6
      )
        continue;
      const reachTargets = territoryIds
        .filter(
          (id) =>
            state.owners.get(id) === owner &&
            neighborsOf(ctx, id).some((n) => state.owners.get(n) === ctx.botId),
        )
        .sort((a, b) => troopsIn(state, a) - troopsIn(state, b));
      if (reachTargets.length === 0) continue;
      const target = reachTargets[0];
      candidates.push(
        ...stackCandidates(
          ctx,
          state,
          objective({
            kind: 'spoilContinent',
            targetPlayerId: owner,
            continentId,
            mustVisit: [target],
            fortifyHint: target,
          }),
          budget,
        ),
      );
    }
  }
  return candidates;
}

export function gatherCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  return [
    ...completeCandidates(ctx, state, budget),
    ...breakCandidates(ctx, state, budget),
    ...eliminateCandidates(ctx, state, budget),
    ...spoilContinentCandidates(ctx, state, budget),
    ...neutralizeThreatCandidates(ctx, state, budget),
    ...antiLeaderCandidates(ctx, state, budget),
    ...preyCandidates(ctx, state, budget),
    ...modeCandidates(ctx, state, budget),
    ...mergeCandidates(ctx, state, budget),
    ...shrinkBorderCandidates(ctx, state, budget),
    ...holdChokepointCandidates(ctx, state, budget),
    ...cardCandidates(ctx, state, budget),
    ...defensiveCandidates(ctx, state, budget),
  ];
}

export function repairStaging(
  ctx: PlanContext,
  state: SimState,
  remaining: number[],
): { staging: number; route: number[] } | null {
  const staging = pickStaging(ctx, state, new Set(remaining));
  if (staging === null) return null;
  const route = routeStack(ctx, state, staging, remaining, null);
  if (route.path.length === 0) return null;
  return { staging, route: route.path };
}
