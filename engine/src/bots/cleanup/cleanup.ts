import { attackDiceFor } from '../../game/combat/dice';
import { attackWinProbability, scaledOutcome } from '../features/combat';
import {
  PlanContext,
  SimState,
  attackersOf,
  cloneState,
  defenceDiceAt,
  holdsContinent,
  isBotBorder,
  isFriendly,
  isHazard,
  ownedIds,
  touchingOf,
  troopsIn,
  troopsPerDefenderAt,
} from '../planning/context';
import {
  Candidate,
  StackPlan,
  defensiveDeployments,
  multiDeployments,
  stagingNeed,
  supplyConnected,
} from '../planning/simulate';
import { Deployment, Objective } from '../planning/turnPlan';

const SURE_HOP = 0.97;
const MAX_CLUSTER_SIZE = 6;
const MIN_EMBEDDED = 0.6;
const MAX_CLUSTERS = 24;
const MAX_HOP_ATTACKERS = 400;

interface Job {
  id: number;
  attackers: number;
  loss: number;
  move: number;
  children: Job[];
}

interface Option {
  stagingId: number;
  root: Job;
}

interface Cluster {
  members: number[];
  options: Option[];
}

interface Assignment {
  roots: Map<number, Job[]>;
  needs: Map<number, number>;
  deploys: Map<number, number>;
  total: number;
}

function cost(job: Job): number {
  return job.loss + job.move;
}

function orderJobs(jobs: Job[]): void {
  jobs.sort(
    (a, b) => b.attackers - cost(b) - (a.attackers - cost(a)) || a.id - b.id,
  );
}

function holderNeed(jobs: Job[]): number {
  const ordered = [...jobs];
  orderJobs(ordered);
  return holderNeedOrdered(ordered);
}

function minAttackers(
  ctx: PlanContext,
  defenders: number,
  defenceDice: number,
  attackDice: number,
): number | null {
  const sure = (attackers: number) =>
    attackWinProbability(
      ctx.game,
      attackers,
      defenders,
      defenceDice,
      attackDice,
    ) >= SURE_HOP;
  let high = Math.max(2, defenders);
  while (!sure(high)) {
    if (high >= MAX_HOP_ATTACKERS) return null;
    high = Math.min(MAX_HOP_ATTACKERS, high * 2);
  }
  let low = 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sure(mid)) high = mid;
    else low = mid + 1;
  }
  return low;
}

function buildJob(
  ctx: PlanContext,
  state: SimState,
  id: number,
  fromId: number,
  members: Set<number>,
  reached: Set<number>,
): Job | null {
  const defenders = troopsIn(state, id);
  const defenceDice = defenceDiceAt(ctx, id);
  const attackDice = attackDiceFor(ctx.game, fromId);
  const attackers = minAttackers(ctx, defenders, defenceDice, attackDice);
  if (attackers === null) return null;
  const outcome = scaledOutcome(
    ctx.game,
    attackers,
    defenders,
    defenceDice,
    attackDice,
  );
  const loss = Math.max(
    0,
    Math.ceil(attackers - outcome.attackerSurvivorsMean),
  );
  reached.add(id);
  const children: Job[] = [];
  for (const member of members) {
    if (reached.has(member) || !attackersOf(ctx, member).includes(id)) continue;
    const child = buildJob(ctx, state, member, id, members, reached);
    if (child === null) return null;
    children.push(child);
  }
  orderJobs(children);
  const forced = Math.min(attackDice, Math.max(1, attackers - loss));
  return {
    id,
    attackers,
    loss,
    move: Math.max(holderNeed(children), forced),
    children,
  };
}

function embeddedness(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  const around = touchingOf(ctx, territoryId);
  if (around.length === 0) return 0;
  const mine = around.filter((n) => {
    const ownerId = state.owners.get(n);
    return ownerId !== undefined && isFriendly(ctx, ownerId);
  }).length;
  return mine / around.length;
}

function sameOwnerGroups(
  ctx: PlanContext,
  state: SimState,
  allowed: (territoryId: number) => boolean,
  ownerId: number,
  startIds: number[],
  seen: Set<number>,
): number[][] {
  const groups: number[][] = [];
  for (const startId of startIds) {
    if (seen.has(startId) || !allowed(startId)) continue;
    const members: number[] = [];
    const queue = [startId];
    seen.add(startId);
    while (queue.length > 0) {
      const current = queue.pop()!;
      members.push(current);
      for (const n of touchingOf(ctx, current)) {
        if (seen.has(n) || state.owners.get(n) !== ownerId || !allowed(n))
          continue;
        seen.add(n);
        queue.push(n);
      }
    }
    groups.push(members);
  }
  return groups;
}

function isEnclosed(
  ctx: PlanContext,
  state: SimState,
  members: number[],
): boolean {
  const inside = new Set(members);
  return members.every(
    (id) =>
      !isHazard(ctx, id) &&
      touchingOf(ctx, id).every((n) => {
        if (inside.has(n)) return true;
        const ownerId = state.owners.get(n);
        return ownerId !== undefined && isFriendly(ctx, ownerId);
      }),
  );
}

function enemyClusters(ctx: PlanContext, state: SimState): number[][] {
  const everyone = new Set<number>();
  const clusters: number[][] = [];
  for (const [id, ownerId] of state.owners) {
    if (everyone.has(id) || isFriendly(ctx, ownerId)) continue;
    const component = sameOwnerGroups(
      ctx,
      state,
      () => true,
      ownerId,
      [id],
      everyone,
    )[0];
    if (
      component.length <= MAX_CLUSTER_SIZE &&
      isEnclosed(ctx, state, component)
    ) {
      clusters.push(component);
      continue;
    }
    const deep = new Set(
      component.filter(
        (tile) =>
          !isHazard(ctx, tile) &&
          embeddedness(ctx, state, tile) >= MIN_EMBEDDED,
      ),
    );
    const grown = sameOwnerGroups(
      ctx,
      state,
      (tile) => deep.has(tile),
      ownerId,
      component,
      new Set<number>(),
    );
    for (const group of grown)
      if (group.length <= MAX_CLUSTER_SIZE) clusters.push(group);
  }
  return clusters;
}

function clusterOptions(
  ctx: PlanContext,
  state: SimState,
  members: number[],
): Cluster | null {
  const memberSet = new Set(members);
  const options: Option[] = [];
  const seenPairs = new Set<number>();
  for (const entry of members) {
    for (const stagingId of attackersOf(ctx, entry)) {
      if (memberSet.has(stagingId) || state.owners.get(stagingId) !== ctx.botId)
        continue;
      if (!supplyConnected(ctx, stagingId)) continue;
      const key = stagingId * 100_000 + entry;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const reached = new Set<number>();
      const root = buildJob(ctx, state, entry, stagingId, memberSet, reached);
      if (root !== null && reached.size === memberSet.size)
        options.push({ stagingId, root });
    }
  }
  return options.length > 0 ? { members, options } : null;
}

function deployOf(state: SimState, stagingId: number, roots: Job[]): number {
  return Math.max(0, holderNeed(roots) - troopsIn(state, stagingId));
}

function assign(
  ctx: PlanContext,
  state: SimState,
  clusters: Cluster[],
  sparingBorders: boolean,
): Assignment {
  const roots = new Map<number, Job[]>();
  const deploys = new Map<number, number>();
  const ordered = [...clusters].sort(
    (a, b) =>
      Math.min(...b.options.map((o) => o.root.attackers)) -
      Math.min(...a.options.map((o) => o.root.attackers)),
  );
  for (const cluster of ordered) {
    let best: Option | null = null;
    let bestCost = Infinity;
    for (const option of cluster.options) {
      const current = roots.get(option.stagingId) ?? [];
      const before = deployOf(state, option.stagingId, current);
      const after = deployOf(state, option.stagingId, [
        ...current,
        option.root,
      ]);
      const consumed = Math.min(
        troopsIn(state, option.stagingId),
        holderNeed([...current, option.root]),
      );
      const penalty =
        sparingBorders && isBotBorder(ctx, state, option.stagingId)
          ? consumed -
            Math.min(troopsIn(state, option.stagingId), holderNeed(current))
          : 0;
      const optionCost =
        after - before + penalty - troopsIn(state, option.stagingId) * 1e-6;
      if (optionCost < bestCost) {
        bestCost = optionCost;
        best = option;
      }
    }
    if (best === null) continue;
    const list = roots.get(best.stagingId) ?? [];
    list.push(best.root);
    roots.set(best.stagingId, list);
  }
  const needs = new Map<number, number>();
  let total = 0;
  for (const [stagingId, jobs] of roots) {
    needs.set(stagingId, holderNeed(jobs));
    const deploy = deployOf(state, stagingId, jobs);
    deploys.set(stagingId, deploy);
    total += deploy;
  }
  return { roots, needs, deploys, total };
}

function cleanupObjectives(
  ctx: PlanContext,
  state: SimState,
  captured: number[],
): Objective[] {
  const after = cloneState(state);
  for (const id of captured) after.owners.set(id, ctx.botId);
  const objectives: Objective[] = [];
  const touched = new Set(captured);
  const ownersLeft = new Set(captured.map((id) => state.owners.get(id)!));
  for (const ownerId of ownersLeft) {
    const left = ownedIds(after, ownerId);
    if (left.length === 0)
      objectives.push({
        kind: 'eliminate',
        targetPlayerId: ownerId,
        continentId: null,
        mustVisit: captured.filter((id) => state.owners.get(id) === ownerId),
      });
  }
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    if (!territoryIds.some((id) => touched.has(id))) continue;
    if (
      holdsContinent(ctx, state, territoryIds, ctx.botId) ||
      !holdsContinent(ctx, after, territoryIds, ctx.botId)
    )
      continue;
    objectives.push({
      kind: 'complete',
      targetPlayerId: null,
      continentId,
      mustVisit: territoryIds.filter((id) => touched.has(id)),
    });
  }
  objectives.push({
    kind: 'cleanup',
    targetPlayerId: null,
    continentId: null,
    mustVisit: captured,
  });
  return objectives;
}

function emitStacks(
  parentId: number,
  ordered: Job[],
  stacks: StackPlan[],
): void {
  for (const job of ordered) {
    stacks.push({
      startId: parentId,
      route: [job.id],
      objectiveIndex: 0,
      move: job.move,
    });
    const children = [...job.children];
    orderJobs(children);
    emitStacks(job.id, children, stacks);
  }
}

function stagingOrder(state: SimState, stagingId: number, roots: Job[]): Job[] {
  const frugal = [...roots];
  orderJobs(frugal);
  const chainsFirst = [...roots].sort(
    (a, b) => cost(b) - cost(a) || a.id - b.id,
  );
  const limit = Math.max(holderNeed(roots), troopsIn(state, stagingId));
  return holderNeedOrdered(chainsFirst) <= limit ? chainsFirst : frugal;
}

function holderNeedOrdered(ordered: Job[]): number {
  let spent = 0;
  let need = 1;
  for (const job of ordered) {
    need = Math.max(need, 1 + job.attackers + spent, 1 + spent + cost(job));
    spent += cost(job);
  }
  return need;
}

function toCandidate(
  ctx: PlanContext,
  state: SimState,
  assignment: Assignment,
  budget: number,
  objectives: Objective[],
): Candidate {
  const stacks: StackPlan[] = [];
  const deployments: Deployment[] = [];
  for (const stagingId of [...assignment.roots.keys()].sort((a, b) => a - b)) {
    emitStacks(
      stagingId,
      stagingOrder(state, stagingId, assignment.roots.get(stagingId)!),
      stacks,
    );
    const deploy = assignment.deploys.get(stagingId) ?? 0;
    if (deploy > 0)
      deployments.push({ territoryId: stagingId, troops: deploy });
  }
  const leftover = budget - assignment.total;
  if (leftover > 0)
    deployments.push(...defensiveDeployments(ctx, state, leftover));
  return { objectives, deployments, stacks };
}

function signature(assignment: Assignment): string {
  return [...assignment.roots]
    .map(([stagingId, jobs]) => `${stagingId}:${jobs.map((j) => j.id).sort()}`)
    .sort()
    .join('|');
}

function buildClusters(ctx: PlanContext, state: SimState): Cluster[] {
  return enemyClusters(ctx, state)
    .map((members) => clusterOptions(ctx, state, members))
    .filter((cluster): cluster is Cluster => cluster !== null)
    .sort((a, b) => costPerTile(a) - costPerTile(b))
    .slice(0, MAX_CLUSTERS);
}

function costPerTile(cluster: Cluster): number {
  return (
    Math.min(...cluster.options.map((o) => o.root.attackers)) /
    cluster.members.length
  );
}

function fitClusters(
  ctx: PlanContext,
  state: SimState,
  all: Cluster[],
  budget: number,
): { clusters: Cluster[]; plain: Assignment } {
  let clusters = all;
  let plain = assign(ctx, state, clusters, false);
  while (plain.total > budget && clusters.length > 0) {
    const worst = clusters.reduce((a, b) =>
      costPerTile(b) > costPerTile(a) ? b : a,
    );
    clusters = clusters.filter((cluster) => cluster !== worst);
    plain = assign(ctx, state, clusters, false);
  }
  return { clusters, plain };
}

export function cleanupCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  if (!ctx.params.cleanup || ctx.personality !== 'balanced') return [];
  const { clusters, plain } = fitClusters(
    ctx,
    state,
    buildClusters(ctx, state),
    budget,
  );
  if (clusters.length === 0) return [];

  const objectives = cleanupObjectives(
    ctx,
    state,
    clusters.flatMap((cluster) => cluster.members),
  );
  const candidates = [toCandidate(ctx, state, plain, budget, objectives)];
  const sparing = assign(ctx, state, clusters, true);
  if (sparing.total <= budget && signature(sparing) !== signature(plain))
    candidates.push(toCandidate(ctx, state, sparing, budget, objectives));
  return candidates;
}

function derivedCosts(
  ctx: PlanContext,
  state: SimState,
  base: Candidate,
): { id: number; cost: number }[] {
  const costs = new Map<number, number>();
  for (const stack of base.stacks) {
    let cost = 0;
    for (const id of stack.route)
      if (state.owners.get(id) !== ctx.botId)
        cost += 1 + troopsIn(state, id) * troopsPerDefenderAt(ctx, id);
    costs.set(stack.startId, (costs.get(stack.startId) ?? 0) + cost);
  }
  return [...costs].map(([id, cost]) => ({ id, cost }));
}

function trimDeployments(
  deployments: Deployment[],
  amount: number,
): Deployment[] {
  const trimmed = deployments.map((d) => ({ ...d }));
  let remaining = amount;
  for (let i = trimmed.length - 1; i >= 0 && remaining > 0; i--) {
    const cut = Math.min(trimmed[i].troops, remaining);
    trimmed[i].troops -= cut;
    remaining -= cut;
  }
  return trimmed.filter((d) => d.troops > 0);
}

export function cleanupExtension(
  ctx: PlanContext,
  state: SimState,
  base: Candidate,
  budget: number,
): Candidate | null {
  if (!ctx.params.cleanup || ctx.personality !== 'balanced') return null;
  const targets = new Set<number>();
  for (const stack of base.stacks) {
    for (const id of stack.route) targets.add(id);
  }
  const spare = cloneState(state);
  const stagingCosts = base.stagingCosts ?? derivedCosts(ctx, state, base);
  let required = 0;
  for (const { id, cost } of stagingCosts) {
    required += Math.max(0, stagingNeed(state, id, cost));
    const surplus = -stagingNeed(state, id, cost);
    spare.troops.set(id, Math.max(1, surplus + 1));
  }
  const reserve = Math.max(0, budget - required);
  const usable = buildClusters(ctx, spare)
    .filter((cluster) => !cluster.members.some((id) => targets.has(id)))
    .map((cluster) => ({
      ...cluster,
      options: cluster.options.filter((o) => !targets.has(o.stagingId)),
    }))
    .filter((cluster) => cluster.options.length > 0);
  const { clusters, plain } = fitClusters(ctx, spare, usable, reserve);
  if (clusters.length === 0) return null;

  const objective: Objective = {
    kind: 'cleanup',
    targetPlayerId: null,
    continentId: null,
    mustVisit: clusters.flatMap((cluster) => cluster.members),
  };
  const extra = toCandidate(ctx, spare, plain, plain.total, [objective]);
  const objectiveIndex = base.objectives.length;
  const kept =
    stagingCosts.length > 0
      ? multiDeployments(ctx, state, stagingCosts, budget - plain.total)
      : trimDeployments(base.deployments, plain.total);
  return {
    ...base,
    objectives: [...base.objectives, objective],
    deployments: [...kept, ...extra.deployments],
    stacks: [
      ...extra.stacks.map((stack) => ({ ...stack, objectiveIndex })),
      ...base.stacks,
    ],
  };
}
