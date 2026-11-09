import {
  PlanContext,
  SimState,
  attackersOf,
  isFriendly,
  ownedIds,
  troopsIn,
  troopsPerDefenderAt,
} from '../planning/context';
import { Candidate, stackCandidates } from '../planning/simulate';
import { ClaimContinent, continentClaims } from './model';

const CRUSH_MIN_CLAIM = 0.35;
const MAX_CRUSH_CONTINENTS = 2;
const MAX_CRUSH_TARGETS = 4;
const CRUSH_FEASIBILITY = 1;
const CRUSH_END_SHARE = 0.25;
const CRUSH_DECISIVE_SHARE = 0.5;
const NEAR_DONE_REMAINING = 2;
const NEAR_DONE_BOOST = 1.5;
const MAX_PUNISH_INTRUDERS = 2;
const MAX_PUNISH_TARGETS = 4;

interface CrushStep {
  ids: number[];
  claim: number;
}

function heldBy(state: SimState, ids: number[], playerId: number): number[] {
  return ids
    .filter((id) => state.owners.get(id) === playerId)
    .sort((a, b) => troopsIn(state, a) - troopsIn(state, b));
}

function largestStack(ctx: PlanContext, state: SimState): number {
  let largest = 0;
  for (const id of ownedIds(state, ctx.botId))
    largest = Math.max(largest, troopsIn(state, id));
  return largest;
}

function defendersCost(
  ctx: PlanContext,
  state: SimState,
  ids: number[],
): number {
  return ids.reduce(
    (sum, id) => sum + 1 + troopsIn(state, id) * troopsPerDefenderAt(ctx, id),
    0,
  );
}

function crushSteps(
  ctx: PlanContext,
  state: SimState,
  continent: ClaimContinent,
  playerId: number,
  startClaim: number,
): CrushStep[] {
  const setup = ctx.claims!.setup;
  const owners = new Map<number, number>();
  const troops = new Map<number, number>();
  for (const id of continent.ids) {
    const ownerId = state.owners.get(id);
    if (ownerId !== undefined) owners.set(id, ownerId);
    troops.set(id, troopsIn(state, id));
  }
  const claimNow = () =>
    continentClaims(setup, continent, owners, troops).get(playerId) ?? 0;
  const reachable = (id: number) =>
    attackersOf(ctx, id).some(
      (n) => (owners.get(n) ?? state.owners.get(n)) === ctx.botId,
    );

  const steps: CrushStep[] = [];
  const picked: number[] = [];
  let before = startClaim;
  while (
    picked.length < MAX_CRUSH_TARGETS &&
    before > startClaim * CRUSH_END_SHARE
  ) {
    let best: number | null = null;
    let bestRatio = 0;
    for (const id of continent.ids) {
      if (owners.get(id) !== playerId || !reachable(id)) continue;
      const garrison = troops.get(id)!;
      owners.set(id, ctx.botId);
      troops.set(id, 1);
      const reduction = before - claimNow();
      owners.set(id, playerId);
      troops.set(id, garrison);
      const ratio = reduction / (1 + garrison * troopsPerDefenderAt(ctx, id));
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = id;
      }
    }
    if (best === null) break;
    owners.set(best, ctx.botId);
    troops.set(best, 1);
    picked.push(best);
    before = claimNow();
    steps.push({ ids: [...picked], claim: before });
  }
  return steps;
}

export function crushClaimCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const claims = ctx.claims;
  if (!claims) return [];
  const targets: {
    continent: ClaimContinent;
    playerId: number;
    claim: number;
    weight: number;
  }[] = [];
  for (const continent of claims.setup.continents) {
    for (const [playerId, claim] of claims.current.get(continent.id) ?? []) {
      if (isFriendly(ctx, playerId) || claim < CRUSH_MIN_CLAIM) continue;
      const held = continent.ids.filter(
        (id) => state.owners.get(id) === playerId,
      ).length;
      const remaining = continent.ids.length - held;
      if (held === 0 || remaining === 0) continue;
      targets.push({
        continent,
        playerId,
        claim,
        weight:
          continent.bonus *
          claim *
          (1 + (claims.greed.get(playerId) ?? 0)) *
          (remaining <= NEAR_DONE_REMAINING ? NEAR_DONE_BOOST : 1),
      });
    }
  }
  const power = largestStack(ctx, state) - 1 + budget;
  return targets
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CRUSH_CONTINENTS)
    .flatMap(({ continent, playerId, claim }) => {
      const feasible = crushSteps(
        ctx,
        state,
        continent,
        playerId,
        claim,
      ).filter(
        ({ ids }) =>
          power >= CRUSH_FEASIBILITY * defendersCost(ctx, state, ids),
      );
      if (feasible.length === 0) return [];
      const decisive =
        feasible.find((step) => step.claim <= claim * CRUSH_DECISIVE_SHARE) ??
        feasible[feasible.length - 1];
      const widest = feasible[feasible.length - 1];
      return [...new Set([decisive, widest])].flatMap(({ ids }) =>
        stackCandidates(
          ctx,
          state,
          {
            kind: 'crushClaim',
            targetPlayerId: playerId,
            continentId: continent.id,
            mustVisit: ids,
          },
          budget,
        ),
      );
    });
}

export function withoutCovered(
  covered: Candidate[],
  candidates: Candidate[],
): Candidate[] {
  const keyOf = (candidate: Candidate) =>
    `${candidate.objectives[0].continentId}:${candidate.objectives[0].targetPlayerId}`;
  const keys = new Set(covered.map(keyOf));
  return candidates.filter((candidate) => !keys.has(keyOf(candidate)));
}

export function punishCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const claims = ctx.claims;
  if (!claims) return [];
  return [...claims.intruders]
    .sort((a, b) => b[1].severity - a[1].severity)
    .slice(0, MAX_PUNISH_INTRUDERS)
    .flatMap(([playerId, intruder]) => {
      const continent = claims.setup.continents.find(
        (c) => c.id === intruder.continentId,
      );
      if (!continent) return [];
      const ids = heldBy(state, continent.ids, playerId)
        .filter((id) =>
          attackersOf(ctx, id).some((n) => state.owners.get(n) === ctx.botId),
        )
        .slice(0, MAX_PUNISH_TARGETS);
      if (ids.length === 0) return [];
      return stackCandidates(
        ctx,
        state,
        {
          kind: 'punish',
          targetPlayerId: playerId,
          continentId: continent.id,
          mustVisit: ids,
          fortifyHint: ids[0],
        },
        budget,
      );
    });
}
