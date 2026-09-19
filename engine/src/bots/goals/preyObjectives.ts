import { targetPreference } from '../features/standing';
import {
  PlanContext,
  SimState,
  neighborsOf,
  ownedIds,
  troopsIn,
} from '../planning/context';
import { Candidate, stackCandidates } from '../planning/simulate';

const PREY_THRESHOLD = 0.25;
const MAX_PREY = 2;
const MAX_PREY_TARGETS = 3;

function borderTargetsByOwner(
  ctx: PlanContext,
  state: SimState,
): Map<number, Set<number>> {
  const byOwner = new Map<number, Set<number>>();
  for (const id of ownedIds(state, ctx.botId)) {
    for (const n of neighborsOf(ctx, id)) {
      const ownerId = state.owners.get(n);
      if (ownerId === undefined) continue;
      if (targetPreference(ctx.standing, ownerId) <= PREY_THRESHOLD) continue;
      const targets = byOwner.get(ownerId);
      if (targets) targets.add(n);
      else byOwner.set(ownerId, new Set([n]));
    }
  }
  return byOwner;
}

export function preyCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  return [...borderTargetsByOwner(ctx, state)]
    .sort(
      (a, b) =>
        targetPreference(ctx.standing, b[0]) -
        targetPreference(ctx.standing, a[0]),
    )
    .slice(0, MAX_PREY)
    .flatMap(([playerId, targets]) =>
      stackCandidates(
        ctx,
        state,
        {
          kind: 'prey',
          targetPlayerId: playerId,
          continentId: null,
          mustVisit: [...targets]
            .sort((a, b) => troopsIn(state, a) - troopsIn(state, b))
            .slice(0, MAX_PREY_TARGETS),
        },
        budget,
      ),
    );
}
