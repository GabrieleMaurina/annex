import { sortieCapitals } from '../features/mode/capitalGuard';
import {
  PlanContext,
  SimState,
  bonusOf,
  holdsContinent,
  hostileNeighborsOf,
  planDepth,
  troopsIn,
  troopsPerDefenderAt,
} from '../planning/context';
import {
  Candidate,
  offensiveDeployments,
  supplyConnected,
} from '../planning/simulate';

const SORTIE_SPEND = 0.6;
const SORTIE_LENGTHS = [2, 4, 7];
const BREAK_DISCOUNT = 3;
const CAPITAL_DISCOUNT = 6;

function stepCost(ctx: PlanContext, state: SimState, id: number): number {
  return troopsIn(state, id) * troopsPerDefenderAt(ctx, id);
}

function stepAppeal(ctx: PlanContext, state: SimState, id: number): number {
  const ownerId = state.owners.get(id)!;
  const continentId = ctx.territoryContinent.get(id);
  const breaks =
    continentId !== undefined &&
    bonusOf(ctx, continentId) > 0 &&
    holdsContinent(
      ctx,
      state,
      ctx.continentTerritories.get(continentId) ?? [],
      ownerId,
    );
  return (
    (breaks ? BREAK_DISCOUNT : 0) +
    (ctx.game.capitalTerritoryIds.has(id) ? CAPITAL_DISCOUNT : 0)
  );
}

function sortieRoute(
  ctx: PlanContext,
  state: SimState,
  capitalId: number,
): { route: number[]; costs: number[] } {
  const route: number[] = [];
  const costs: number[] = [];
  const visited = new Set([capitalId]);
  const affordable = SORTIE_SPEND * troopsIn(state, capitalId);
  let current = capitalId;
  let spent = 0;
  while (route.length < planDepth(ctx)) {
    let next: number | null = null;
    let nextScore = Infinity;
    for (const n of hostileNeighborsOf(ctx, state, current)) {
      if (visited.has(n) || !state.owners.has(n)) continue;
      const score = stepCost(ctx, state, n) - stepAppeal(ctx, state, n);
      if (score < nextScore) {
        nextScore = score;
        next = n;
      }
    }
    if (next === null) break;
    const cost = stepCost(ctx, state, next);
    if (spent + cost > affordable) break;
    spent += cost;
    visited.add(next);
    route.push(next);
    costs.push(spent);
    current = next;
  }
  return { route, costs };
}

export function sortieCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  return sortieCapitals(ctx, state).flatMap((capitalId) => {
    if (!supplyConnected(ctx, capitalId)) return [];
    const { route, costs } = sortieRoute(ctx, state, capitalId);
    const lengths = [
      ...new Set([
        ...SORTIE_LENGTHS.filter((length) => length < route.length),
        route.length,
      ]),
    ].filter((length) => length >= 2);
    return lengths.map((length) => {
      const mustVisit = route.slice(0, length);
      const cost = costs[length - 1];
      return {
        objectives: [
          {
            kind: 'sortie' as const,
            targetPlayerId: state.owners.get(mustVisit[0]) ?? null,
            continentId: null,
            mustVisit,
            fortifyHint: capitalId,
          },
        ],
        deployments: offensiveDeployments(ctx, state, capitalId, budget, cost),
        stacks: [{ startId: capitalId, route: mustVisit, objectiveIndex: 0 }],
        fortifyHint: capitalId,
        stagingCosts: [{ id: capitalId, cost }],
      };
    });
  });
}
