import { MAX_TERRITORY_TROOPS } from '../../../game/mechanics';
import { BotProfile, Game } from '../../../types';
import { FORCED_HAND } from '../../features/cardOutlook';
import { guardedCapitals } from '../../features/mode/capitalGuard';
import {
  PlanContext,
  SimState,
  buildContext,
  hostileNeighborsOf,
  ownedIds,
  snapshotState,
  troopsIn,
  troopsPerDefenderAt,
} from '../../planning/context';
import {
  Candidate,
  reachableOwned,
  stagingNeed,
  supplyConnected,
} from '../../planning/simulate';
import { Deployment, FortifyMove } from '../../planning/turnPlan';
import { Weights } from '../../types';

export const hoarderWeights: Weights = {
  completeContinent: 0,
  breakContinent: 0,
  eliminate: 0.3,
  stack: 3,
  grudge: 0,
  defendFrontier: 0,
  antiLeader: 0,
  defense: 1,
  holdChokepoint: 0,
  duelBreak: 0,
  duelStack: 3,
  duelRoll: 0,
  aggression: 0,
  keepStack: 3,
};

interface CardAttack {
  fromId: number;
  toId: number;
}

export function holdsCardsUntilForced(ctx: PlanContext): boolean {
  return (
    ctx.personality === 'hoarder' &&
    (ctx.game.playerCards.get(ctx.botId)?.length ?? 0) < FORCED_HAND
  );
}

export function hoarderDone(ctx: PlanContext): boolean {
  return ctx.personality === 'hoarder' && ctx.game.conqueredThisTurn;
}

function hoardOf(ctx: PlanContext, state: SimState): number | null {
  const owned = ownedIds(state, ctx.botId).filter((id) =>
    supplyConnected(ctx, id),
  );
  const capitals = guardedCapitals(ctx).filter((id) => owned.includes(id));
  const pool = capitals.length > 0 ? capitals : owned;
  if (pool.length === 0) return null;
  return pool.reduce((best, id) =>
    troopsIn(state, id) > troopsIn(state, best) ? id : best,
  );
}

export function hoardPlacement(
  game: Game,
  botId: number,
  botProfile: BotProfile,
): number | null {
  if (botProfile.personality !== 'hoarder') return null;
  const ctx = buildContext(game, botId, botProfile, null);
  return hoardOf(ctx, snapshotState(ctx));
}

export function hoardCapital(game: Game, botId: number): number | null {
  let best: number | null = null;
  for (const [id, ownerId] of game.territoryOwners) {
    if (ownerId !== botId || game.capitalTerritoryIds.has(id)) continue;
    const troops = game.territoryTroops.get(id) ?? 0;
    if (best === null || troops > (game.territoryTroops.get(best) ?? 0))
      best = id;
  }
  return best;
}

function weakestTarget(
  ctx: PlanContext,
  state: SimState,
  fromId: number,
): number | null {
  const targets = hostileNeighborsOf(ctx, state, fromId).filter((id) =>
    state.owners.has(id),
  );
  if (targets.length === 0) return null;
  return targets.reduce((best, id) =>
    defenderCost(ctx, state, id) < defenderCost(ctx, state, best) ? id : best,
  );
}

function defenderCost(
  ctx: PlanContext,
  state: SimState,
  territoryId: number,
): number {
  return (
    1 + troopsIn(state, territoryId) * troopsPerDefenderAt(ctx, territoryId)
  );
}

function easier(
  ctx: PlanContext,
  state: SimState,
  hoard: number,
  a: CardAttack,
  b: CardAttack,
): boolean {
  const cost =
    defenderCost(ctx, state, a.toId) - defenderCost(ctx, state, b.toId);
  if (cost !== 0) return cost < 0;
  if ((a.fromId === hoard) !== (b.fromId === hoard)) return a.fromId === hoard;
  return troopsIn(state, a.fromId) > troopsIn(state, b.fromId);
}

function cardAttack(
  ctx: PlanContext,
  state: SimState,
  hoard: number,
): CardAttack | null {
  let best: CardAttack | null = null;
  for (const fromId of ownedIds(state, ctx.botId)) {
    if (!supplyConnected(ctx, fromId)) continue;
    const toId = weakestTarget(ctx, state, fromId);
    if (toId === null) continue;
    const attack = { fromId, toId };
    if (best === null || easier(ctx, state, hoard, attack, best)) best = attack;
  }
  return best;
}

function cardDeployments(
  ctx: PlanContext,
  state: SimState,
  hoard: number,
  attack: CardAttack,
  budget: number,
): Deployment[] {
  if (budget <= 0) return [];
  if (attack.fromId === hoard) return [{ territoryId: hoard, troops: budget }];
  const need = Math.min(
    budget,
    Math.max(
      0,
      stagingNeed(state, attack.fromId, defenderCost(ctx, state, attack.toId)),
    ),
  );
  return [
    { territoryId: attack.fromId, troops: need },
    { territoryId: hoard, troops: budget - need },
  ].filter((deployment) => deployment.troops > 0);
}

export function hoarderCandidates(
  ctx: PlanContext,
  state: SimState,
  budget: number,
): Candidate[] {
  const hoard = hoardOf(ctx, state);
  if (hoard === null) return [];
  const hold: Candidate = {
    objectives: [
      {
        kind: 'defensive',
        targetPlayerId: null,
        continentId: null,
        mustVisit: [],
      },
    ],
    deployments: budget > 0 ? [{ territoryId: hoard, troops: budget }] : [],
    stacks: [],
  };
  const attack = ctx.game.conqueredThisTurn
    ? null
    : cardAttack(ctx, state, hoard);
  if (attack === null) return [hold];
  return [
    hold,
    {
      objectives: [
        {
          kind: 'card',
          targetPlayerId: state.owners.get(attack.toId) ?? null,
          continentId: null,
          mustVisit: [attack.toId],
        },
      ],
      deployments: cardDeployments(ctx, state, hoard, attack, budget),
      stacks: [
        { startId: attack.fromId, route: [attack.toId], objectiveIndex: 0 },
      ],
    },
  ];
}

export function hoardFortify(
  ctx: PlanContext,
  state: SimState,
): FortifyMove | null {
  const hoard = hoardOf(ctx, state);
  if (hoard === null) return null;
  const source = ownedIds(state, ctx.botId)
    .filter((id) => id !== hoard && troopsIn(state, id) >= 2)
    .sort((a, b) => troopsIn(state, b) - troopsIn(state, a))
    .find((id) => reachableOwned(ctx, state, id).has(hoard));
  if (source === undefined) return null;
  const troops = Math.min(
    troopsIn(state, source) - 1,
    MAX_TERRITORY_TROOPS - troopsIn(state, hoard),
  );
  return troops >= 1 ? { startId: source, endId: hoard, troops } : null;
}
