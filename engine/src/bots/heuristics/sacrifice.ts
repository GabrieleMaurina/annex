import { defenceDiceFor } from '../features/combat';
import { seaBridgeTargets } from '../features/navy';
import { targetPreference } from '../features/standing';
import { frontierTerritories, hostileNeighbors } from '../features/territory';
import {
  PlanContext,
  bonusOf,
  isFriendly,
  ownedChokepoints,
  ownedIds,
  snapshotState,
} from '../planning/context';
import { ownerOf, troopsAt } from '../view';
import { AttackChoice, attackOrder } from './attack';

const MIN_COMMIT = 3;
const MIN_KILL_SHARE = 0.15;
const FOLLOW_UP_MARGIN = 1.15;
const CONTESTED_BASE_CHANCE = 0.15;
const SPECULATIVE_SHARE = 0.5;
const SPECULATIVE_FRUSTRATION_SHARE = 0.4;
const CONTESTED_MIN_EFFICIENCY = 1;
const FRUSTRATED_MIN_EFFICIENCY = 0.55;
const GARRISON_RELAX = 1;
const PROTECTED_GARRISON = 1.3;
const FOLLOW_UP_SCORE = 1.5;
const CONTESTED_SCORE = 0.5;
const PREFERENCE_SCORE = 0.5;
const DICE_SIDES = 6;
const ATTACKER_DICE = 3;
const FIXED_POINT_PASSES = 3;

const killsPerLossCache = new Map<number, number>();

function rollsOf(index: number, dice: number): number[] {
  const rolls: number[] = [];
  let rest = index;
  for (let i = 0; i < dice; i++) {
    rolls.push(rest % DICE_SIDES);
    rest = Math.floor(rest / DICE_SIDES);
  }
  return rolls.sort((a, b) => b - a);
}

function killsPerLoss(defenceDice: number): number {
  const cached = killsPerLossCache.get(defenceDice);
  if (cached !== undefined) return cached;
  const pairs = Math.min(ATTACKER_DICE, defenceDice);
  let attackLosses = 0;
  let defenceLosses = 0;
  for (let a = 0; a < DICE_SIDES ** ATTACKER_DICE; a++) {
    const attack = rollsOf(a, ATTACKER_DICE);
    for (let d = 0; d < DICE_SIDES ** defenceDice; d++) {
      const defence = rollsOf(d, defenceDice);
      for (let i = 0; i < pairs; i++) {
        if (attack[i] > defence[i]) defenceLosses++;
        else attackLosses++;
      }
    }
  }
  const ratio = defenceLosses / attackLosses;
  killsPerLossCache.set(defenceDice, ratio);
  return ratio;
}

function protectedTerritories(ctx: PlanContext): Set<number> {
  const state = snapshotState(ctx);
  const ids = new Set<number>();
  for (const id of ownedIds(state, ctx.botId)) {
    if (ctx.game.capitalTerritoryIds.has(id)) ids.add(id);
  }
  for (const id of ownedChokepoints(ctx, state)) ids.add(id);
  for (const [continentId, territoryIds] of ctx.continentTerritories) {
    if (bonusOf(ctx, continentId) <= 0) continue;
    if (territoryIds.every((id) => state.owners.get(id) === ctx.botId))
      for (const id of territoryIds) ids.add(id);
  }
  return ids;
}

interface CommitInput {
  startTroops: number;
  defenders: number;
  efficiency: number;
  startEfficiency: number;
  otherGarrison: number;
  garrisonFactor: number;
  strongestOther: number;
  speculativeCap: number;
}

function settleCommit(input: CommitInput): {
  commit: number;
  followUp: boolean;
} | null {
  const { startTroops, defenders, efficiency } = input;
  const maxKills = defenders - 1;
  let commit = Math.min(
    startTroops - Math.max(1, input.otherGarrison),
    Math.ceil(maxKills / efficiency),
  );
  for (let pass = 0; pass < FIXED_POINT_PASSES; pass++) {
    const remaining = defenders - Math.min(maxKills, efficiency * commit);
    const followUp =
      input.strongestOther * efficiency >= FOLLOW_UP_MARGIN * remaining;
    const retaliation = followUp
      ? 0
      : Math.ceil(
          Math.max(0, remaining - 1) *
            input.startEfficiency *
            input.garrisonFactor,
        );
    const garrison = Math.max(1, input.otherGarrison, retaliation);
    const limit = Math.min(
      startTroops - garrison,
      followUp ? startTroops : input.speculativeCap,
    );
    const settled = limit >= commit;
    commit = Math.min(commit, limit);
    if (commit < MIN_COMMIT) return null;
    if (settled || pass === FIXED_POINT_PASSES - 1) return { commit, followUp };
  }
  return null;
}

interface Scan {
  contestedAllowed: boolean;
  frustrated: boolean;
  frustration: number;
  stackTroops: Map<number, number>;
  targetsOf: Map<number, number[]>;
  attackersOf: Map<number, number[]>;
  guard: () => Set<number>;
}

interface Scored {
  choice: AttackChoice;
  score: number;
}

function hostileTargets(ctx: PlanContext, startId: number): number[] {
  return hostileNeighbors(ctx.game, ctx.view, ctx.botId, startId).filter(
    (id) => !isFriendly(ctx, ownerOf(ctx.game, ctx.view, id) ?? ctx.botId),
  );
}

function thirdPartyCount(
  ctx: PlanContext,
  endId: number,
  ownerId: number,
): number {
  const owners = new Set<number>();
  for (const n of ctx.neighbors.get(endId) ?? []) {
    const neighborOwner = ownerOf(ctx.game, ctx.view, n);
    if (
      neighborOwner !== undefined &&
      neighborOwner !== ownerId &&
      !isFriendly(ctx, neighborOwner)
    )
      owners.add(neighborOwner);
  }
  return owners.size;
}

function evaluatePair(
  ctx: PlanContext,
  scan: Scan,
  startId: number,
  endId: number,
): Scored | null {
  const { game, view } = ctx;
  const targets = scan.targetsOf.get(startId) ?? [];
  const ownerId = ownerOf(game, view, endId)!;
  const defenders = troopsAt(game, view, endId);
  if (defenders < 2) return null;
  const efficiency = killsPerLoss(defenceDiceFor(game, endId));
  if (efficiency < FRUSTRATED_MIN_EFFICIENCY) return null;

  const preference = targetPreference(ctx.standing, ownerId);
  const contested =
    scan.contestedAllowed &&
    preference >= 0 &&
    efficiency >= CONTESTED_MIN_EFFICIENCY &&
    thirdPartyCount(ctx, endId, ownerId) > 0;
  const strongestOther = Math.max(
    0,
    ...(scan.attackersOf.get(endId) ?? [])
      .filter((id) => id !== startId)
      .map((id) => (scan.stackTroops.get(id) ?? 0) - 1),
  );
  if (!contested && !scan.frustrated && strongestOther === 0) return null;

  const startTroops = scan.stackTroops.get(startId) ?? 0;
  const startEfficiency = killsPerLoss(defenceDiceFor(game, startId));
  const garrisonFactor = scan.guard().has(startId)
    ? PROTECTED_GARRISON * (1 - scan.frustration)
    : 1 - GARRISON_RELAX * scan.frustration;
  const otherThreat = Math.max(
    0,
    ...targets
      .filter((id) => id !== endId)
      .map((id) => troopsAt(game, view, id)),
  );
  const settled = settleCommit({
    startTroops,
    defenders,
    efficiency,
    startEfficiency,
    otherGarrison: Math.ceil(otherThreat * startEfficiency * garrisonFactor),
    garrisonFactor,
    strongestOther,
    speculativeCap: Math.floor(
      (SPECULATIVE_SHARE + SPECULATIVE_FRUSTRATION_SHARE * scan.frustration) *
        (startTroops - 1),
    ),
  });
  if (settled === null) return null;

  const { commit, followUp } = settled;
  const killShare = Math.min(defenders - 1, efficiency * commit) / defenders;
  if (!followUp && killShare < MIN_KILL_SHARE) return null;
  if (!followUp && !contested && !scan.frustrated) return null;

  const score =
    efficiency +
    killShare +
    (followUp ? FOLLOW_UP_SCORE : 0) +
    (contested ? CONTESTED_SCORE : 0) +
    PREFERENCE_SCORE * preference +
    (Math.random() - 0.5) * ctx.params.noise;
  return {
    choice: { startId, endId, ...attackOrder(game, commit) },
    score,
  };
}

export function chooseLosingAttack(
  ctx: PlanContext,
  frustration: number,
): AttackChoice | null {
  const { game, view, botId } = ctx;
  const bridges = seaBridgeTargets(game, view, botId).filter(
    (bridge) =>
      bridge.ownerId !== undefined && !isFriendly(ctx, bridge.ownerId),
  );
  const starts = [
    ...new Set([
      ...frontierTerritories(game, view, botId),
      ...bridges.map((bridge) => bridge.sourceTerritoryId),
    ]),
  ];
  const stackTroops = new Map(
    starts.map((id) => [id, troopsAt(game, view, id)]),
  );
  const targetsOf = new Map(
    starts.map((id) => [
      id,
      [
        ...new Set([
          ...hostileTargets(ctx, id),
          ...bridges
            .filter((bridge) => bridge.sourceTerritoryId === id)
            .map((bridge) => bridge.targetId),
        ]),
      ],
    ]),
  );
  const attackersOf = new Map<number, number[]>();
  for (const [startId, targets] of targetsOf) {
    for (const endId of targets)
      attackersOf.set(endId, [...(attackersOf.get(endId) ?? []), startId]);
  }

  const roll = Math.random();
  let guarded: Set<number> | null = null;
  const scan: Scan = {
    contestedAllowed:
      roll < CONTESTED_BASE_CHANCE + (1 - CONTESTED_BASE_CHANCE) * frustration,
    frustrated: roll < frustration,
    frustration,
    stackTroops,
    targetsOf,
    attackersOf,
    guard: () => (guarded ??= protectedTerritories(ctx)),
  };

  let best: Scored | null = null;
  for (const [startId, targets] of targetsOf) {
    for (const endId of targets) {
      const scored = evaluatePair(ctx, scan, startId, endId);
      if (scored && (best === null || scored.score > best.score)) best = scored;
    }
  }
  return best?.choice ?? null;
}
