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

const CRUSH_MIN_CLAIM = 0.35;
const MAX_CRUSH_CONTINENTS = 2;
const MAX_CRUSH_TARGETS = 8;
const CRUSH_FEASIBILITY = 1;
const MAX_PUNISH_INTRUDERS = 2;
const MAX_PUNISH_TARGETS = 4;

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

export function crushClaimCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const claims = ctx.claims;
  if (!claims) return [];
  const targets: {
    continentId: number;
    playerId: number;
    ids: number[];
    weight: number;
  }[] = [];
  for (const continent of claims.setup.continents) {
    for (const [playerId, claim] of claims.current.get(continent.id) ?? []) {
      if (isFriendly(ctx, playerId) || claim < CRUSH_MIN_CLAIM) continue;
      const ids = heldBy(state, continent.ids, playerId).slice(
        0,
        MAX_CRUSH_TARGETS,
      );
      if (ids.length > 0)
        targets.push({
          continentId: continent.id,
          playerId,
          ids,
          weight: continent.bonus * claim,
        });
    }
  }
  const power = largestStack(ctx, state) - 1 + budget;
  return targets
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CRUSH_CONTINENTS)
    .filter(({ ids }) => {
      const need = ids.reduce(
        (sum, id) =>
          sum + 1 + troopsIn(state, id) * troopsPerDefenderAt(ctx, id),
        0,
      );
      return power >= CRUSH_FEASIBILITY * need;
    })
    .flatMap(({ continentId, playerId, ids }) =>
      stackCandidates(
        ctx,
        state,
        {
          kind: 'crushClaim',
          targetPlayerId: playerId,
          continentId,
          mustVisit: ids,
        },
        budget,
      ),
    );
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
