import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crushClaimCandidates,
  punishCandidates,
} from '../../src/bots/claims/objectives';
import { recentActivity } from '../../src/bots/claims/placements';
import {
  claimFactor,
  contestedShare,
  evaluateClaims,
} from '../../src/bots/claims/score';
import { withGreedStanding } from '../../src/bots/claims/snapshot';
import { chooseTerritoryClaim } from '../../src/bots/heuristics/misc';
import {
  PlanContext,
  buildContext,
  cloneState,
  snapshotState,
} from '../../src/bots/planning/context';
import { gatherCandidates } from '../../src/bots/planning/objectives';
import { defensiveDeployments } from '../../src/bots/planning/simulate';
import { Objective } from '../../src/bots/planning/turnPlan';
import { BotDifficulty, BotPersonality, Game } from '../../src/types';
import { MapSpec, ScenarioSpec, buildGame } from '../testkit';

const TWO_CONTINENTS: MapSpec = {
  continents: [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
  ],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
  ],
  bonuses: [3, 3],
};

const FIVE_CONTINENTS: MapSpec = {
  continents: [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
  ],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
  ],
  bonuses: [2, 2, 2, 2, 2],
};

function contextOf(
  spec: ScenarioSpec,
  personality: BotPersonality = 'balanced',
  difficulty: BotDifficulty = 'hard',
  prepare: (game: Game, botId: number) => void = () => undefined,
): { game: Game; botId: number; ctx: PlanContext } {
  const { game, botId } = buildGame(spec);
  prepare(game, botId);
  const ctx = buildContext(game, botId, { difficulty, personality }, null);
  return { game, botId, ctx };
}

function claimOf(
  ctx: PlanContext,
  continentId: number,
  playerId: number,
): number {
  return ctx.claims!.current.get(continentId)?.get(playerId) ?? 0;
}

function turnStarted(roundNumber: number) {
  return { type: 'game:turnStarted', payload: { roundNumber } };
}

function deployed(playerId: number, territoryId: number, troops: number) {
  return {
    type: 'game:deployed',
    payload: { territoryId, troops, playerId },
  };
}

function greedOfPlayerTwo(continentsHeld: number): number {
  const owners: Record<number, number> = {};
  for (let id = 0; id < 10; id++)
    owners[id] = Math.floor(id / 2) < continentsHeld ? 2 : 1;
  const { ctx } = contextOf({
    map: FIVE_CONTINENTS,
    players: [1, 2, 3],
    owners,
    troops: {},
  });
  return ctx.claims!.greed.get(2) ?? 0;
}

test('only balanced hard bots build claims', () => {
  const spec: ScenarioSpec = {
    map: TWO_CONTINENTS,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 4: 2, 5: 2 },
    troops: {},
  };
  assert.ok(contextOf(spec).ctx.claims);
  assert.equal(contextOf(spec, 'balanced', 'medium').ctx.claims, null);
  assert.equal(contextOf(spec, 'balanced', 'easy').ctx.claims, null);
  assert.equal(contextOf(spec, 'killer', 'hard').ctx.claims, null);
  assert.equal(
    contextOf({ ...spec, settings: { continents: 'off' } }).ctx.claims,
    null,
  );
});

test('placements count fully for two rounds, fade after, and vanish at ten', () => {
  const { game, botId } = buildGame({
    map: TWO_CONTINENTS,
    players: [1, 2, 3, 4],
    owners: { 0: 1, 4: 2 },
    troops: {},
    settings: { roundNumber: 20 },
  });
  game.logs
    .get(botId)!
    .push(
      turnStarted(10),
      deployed(4, 0, 10),
      turnStarted(15),
      deployed(3, 0, 10),
      turnStarted(18),
      deployed(2, 0, 10),
      turnStarted(19),
      {
        type: 'game:deployedMany',
        payload: { deposits: [{ territoryId: 1, troops: 4 }], playerId: 2 },
      },
    );
  const continentOf = new Map([
    [0, 0],
    [1, 0],
  ]);
  const placed = recentActivity(game, botId, continentOf).placements.get(0)!;
  assert.equal(placed.get(2), 14);
  assert.ok(Math.abs(placed.get(3)! - 10 * (5 / 8) ** 2) < 1e-9);
  assert.equal(placed.get(4), undefined);
});

test('a recent placement strengthens a claim and an old one adds nothing', () => {
  const spec: ScenarioSpec = {
    map: TWO_CONTINENTS,
    players: [1, 2, 3],
    owners: { 0: 2, 1: 2, 2: 3, 3: 3, 4: 1, 5: 1 },
    troops: { 0: 3, 1: 3, 2: 3, 3: 3 },
    settings: { roundNumber: 20 },
  };
  const withMarker = (round: number) =>
    contextOf(spec, 'balanced', 'hard', (game, botId) => {
      game.logs.get(botId)!.push(turnStarted(round), deployed(2, 0, 10));
    }).ctx;
  const recent = withMarker(19);
  assert.ok(claimOf(recent, 0, 2) > claimOf(recent, 0, 3));
  const old = withMarker(1);
  assert.ok(Math.abs(claimOf(old, 0, 2) - claimOf(old, 0, 3)) < 1e-9);
});

test('capitals of two different players in one continent weaken every claim there', () => {
  const spec: ScenarioSpec = {
    map: TWO_CONTINENTS,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2 },
    troops: {},
  };
  const none = claimOf(contextOf(spec).ctx, 0, 1);
  const split = claimOf(contextOf({ ...spec, capitals: [0, 3] }).ctx, 0, 1);
  const sole = claimOf(contextOf({ ...spec, capitals: [0] }).ctx, 0, 1);
  assert.ok(split < none * 0.5);
  assert.ok(sole >= none);
});

test('a continent with a strong rival claim is worth less than a quiet one', () => {
  const { ctx } = contextOf({
    map: TWO_CONTINENTS,
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 3, 3: 3, 4: 1, 5: 1, 6: 2, 7: 2 },
    troops: { 0: 5, 1: 5, 2: 1, 3: 1, 4: 5, 5: 5, 6: 20, 7: 20 },
  });
  assert.ok(claimOf(ctx, 0, 1) > claimOf(ctx, 1, 1));
  assert.ok(contestedShare(ctx, 1) > contestedShare(ctx, 0));
});

test('greed grows with the continents a player holds', () => {
  assert.equal(greedOfPlayerTwo(1), 0);
  assert.ok(Math.abs(greedOfPlayerTwo(2) - 1 / 3) < 1e-9);
  assert.ok(Math.abs(greedOfPlayerTwo(3) - 2 / 3) < 1e-9);
  assert.equal(greedOfPlayerTwo(4), 1);
});

test('objectives against a greedy player are favoured over a modest one', () => {
  const objective: Objective = {
    kind: 'break',
    targetPlayerId: 2,
    continentId: null,
    mustVisit: [],
  };
  const modest = contextOf({
    map: FIVE_CONTINENTS,
    players: [1, 2, 3],
    owners: { 0: 2, 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 },
    troops: {},
  }).ctx;
  const greedy = contextOf({
    map: FIVE_CONTINENTS,
    players: [1, 2, 3],
    owners: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1, 9: 1 },
    troops: {},
  }).ctx;
  assert.ok(claimFactor(greedy, objective) > claimFactor(modest, objective));
  assert.equal(claimFactor(modest, { ...objective, targetPlayerId: null }), 1);
});

test('any intruder in a strongly claimed continent is punished', () => {
  const { ctx } = contextOf({
    map: {
      continents: [
        [0, 1, 2, 3, 4],
        [5, 6, 7],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
      ],
      bonuses: [4, 2],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 3 },
    troops: { 0: 8, 1: 8, 2: 8, 3: 8, 4: 3 },
  });
  assert.ok(ctx.claims!.intruders.has(2));
  const state = snapshotState(ctx);
  const candidates = punishCandidates(ctx, state, 10);
  assert.ok(candidates.length > 0);
  for (const candidate of candidates) {
    assert.equal(candidate.objectives[0].kind, 'punish');
    assert.equal(candidate.objectives[0].targetPlayerId, 2);
  }
  const hurt = cloneState(state);
  hurt.damageByPlayer.set(2, 6);
  assert.ok(
    evaluateClaims(ctx, hurt, 1)!.score > evaluateClaims(ctx, state, 1)!.score,
  );
});

test('a rival claim the bot can overwhelm in one turn is attacked and valued once destroyed', () => {
  const spec: ScenarioSpec = {
    map: TWO_CONTINENTS,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2 },
    troops: { 4: 15, 5: 5, 6: 5, 7: 5 },
    troopsToDeploy: 10,
  };
  const { ctx } = contextOf(spec);
  const state = snapshotState(ctx);
  const candidates = crushClaimCandidates(ctx, state, 10);
  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].objectives[0].kind, 'crushClaim');
  assert.equal(candidates[0].objectives[0].targetPlayerId, 2);
  assert.equal(candidates[0].objectives[0].continentId, 1);

  const crushed = cloneState(state);
  for (const id of [5, 6, 7]) crushed.owners.set(id, 1);
  assert.ok(
    evaluateClaims(ctx, crushed, 1)!.score >
      evaluateClaims(ctx, state, 1)!.score,
  );

  const weak = contextOf({
    ...spec,
    troops: { 4: 1, 5: 30, 6: 30, 7: 30 },
    troopsToDeploy: 0,
  }).ctx;
  assert.deepEqual(crushClaimCandidates(weak, snapshotState(weak), 0), []);
});

function lineContinent(
  size: number,
  holders: Record<number, number>,
  garrison: number,
): { ctx: PlanContext } {
  const ids = Array.from({ length: size }, (_, i) => i);
  const owners: Record<number, number> = { [size]: 1 };
  const troops: Record<number, number> = { [size]: 5 };
  for (const [id, playerId] of Object.entries(holders)) {
    owners[Number(id)] = playerId;
    troops[Number(id)] = garrison;
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < size; i++) edges.push([i, i + 1]);
  return contextOf({
    map: { continents: [ids, [size]], edges, bonuses: [4, 1] },
    players: [1, 2, 3],
    owners,
    troops,
  });
}

test('a claim grows with the territories held and a stray garrison stays weak', () => {
  const claimWith = (count: number, garrison: number) =>
    claimOf(
      lineContinent(
        6,
        Object.fromEntries(Array.from({ length: count }, (_, i) => [i, 2])),
        garrison,
      ).ctx,
      0,
      2,
    );
  const curve = [1, 2, 3, 4].map((count) => claimWith(count, 4));
  assert.ok(curve[0] < 0.1);
  assert.ok(curve[1] < curve[2] && curve[2] < curve[3]);
  assert.ok(curve[3] > 0.5);
  assert.ok(claimWith(3, 1) < claimWith(3, 4));
  assert.equal(claimWith(6, 1), 1);
});

test('a continent near a capital is claimed before any territory is taken', () => {
  const { ctx } = contextOf({
    map: TWO_CONTINENTS,
    players: [1, 2, 3],
    owners: { 0: 3, 3: 2, 7: 1 },
    troops: {},
    capitals: [0, 3, 7],
  });
  assert.ok(claimOf(ctx, 1, 2) > claimOf(ctx, 1, 3));
  assert.ok(claimOf(ctx, 1, 3) > 0);
});

test('a claim that has not advanced for many rounds fades', () => {
  const spec: ScenarioSpec = {
    map: TWO_CONTINENTS,
    players: [1, 2, 3],
    owners: { 0: 2, 1: 2, 2: 2, 3: 3, 4: 1, 5: 1 },
    troops: { 0: 4, 1: 4, 2: 4, 3: 4 },
    settings: { roundNumber: 20 },
  };
  const conquest = (round: number) =>
    contextOf(spec, 'balanced', 'hard', (game, botId) => {
      game.logs.get(botId)!.push(turnStarted(round), {
        type: 'game:attacked',
        payload: { defendingTerritoryId: 2, attackerId: 2, conquered: true },
      });
    }).ctx;
  assert.ok(claimOf(conquest(19), 0, 2) > claimOf(conquest(2), 0, 2));
});

test('a rival claim is cut down by the cheapest decisive territories', () => {
  const { ctx } = contextOf({
    map: TWO_CONTINENTS,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2 },
    troops: { 4: 6, 5: 3, 6: 3, 7: 3 },
  });
  const candidates = crushClaimCandidates(ctx, snapshotState(ctx), 0);
  assert.ok(candidates.length > 0);
  for (const candidate of candidates)
    assert.ok(candidate.objectives[0].mustVisit.length < 3);
});

test('weakening a rival claim is valued even without taking its land', () => {
  const { ctx } = contextOf({
    map: TWO_CONTINENTS,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2 },
    troops: { 4: 6, 5: 8, 6: 8, 7: 8 },
  });
  const state = snapshotState(ctx);
  const weakened = cloneState(state);
  for (const id of [5, 6, 7]) weakened.troops.set(id, 1);
  assert.ok(
    evaluateClaims(ctx, weakened, 1)!.score >
      evaluateClaims(ctx, state, 1)!.score,
  );
});

test('the continent the bot claims is guarded harder', () => {
  const { ctx } = contextOf({
    map: TWO_CONTINENTS,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 4: 2 },
    troops: { 0: 4, 1: 4, 2: 4 },
  });
  assert.ok((ctx.claims!.guard.get(0) ?? 1) > 1);
  assert.equal(ctx.claims!.guard.get(4), undefined);
});

test('greed pushes target preference up for greedy rivals and down for modest ones', () => {
  const { ctx } = contextOf({
    map: TWO_CONTINENTS,
    players: [1, 2, 3],
    owners: { 0: 1, 4: 2, 5: 3 },
    troops: {},
  });
  const shifted = withGreedStanding(
    ctx.standing,
    new Map([
      [2, 0],
      [3, 1],
    ]),
  );
  const base = (id: number) => ctx.standing.preference.get(id) ?? 0;
  assert.ok((shifted.preference.get(2) ?? 0) < base(2));
  assert.ok((shifted.preference.get(3) ?? 0) > base(3));
});

test('a continent the bot fully holds has a claim of one even when a rival is near', () => {
  const { ctx } = contextOf({
    map: TWO_CONTINENTS,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2 },
    troops: {},
    capitals: [3, 4],
  });
  assert.equal(claimOf(ctx, 0, 1), 1);
});

test('deployment favours the borders of the continent the bot claims', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3],
        [4, 5, 6],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [2, 4],
        [4, 5],
        [5, 6],
      ],
      bonuses: [4, 2],
    },
    players: [1, 2, 3],
    owners: { 0: 1, 1: 1, 2: 1, 3: 2, 4: 1, 5: 3, 6: 3 },
    troops: { 0: 4, 1: 4, 2: 4, 3: 6, 4: 4, 5: 6, 6: 6 },
  };
  const { ctx } = contextOf(spec);
  const state = snapshotState(ctx);
  const troopsOn = (
    deployments: { territoryId: number; troops: number }[],
    id: number,
  ) => deployments.find((d) => d.territoryId === id)?.troops ?? 0;
  const guarded = defensiveDeployments(ctx, state, 13);
  const plain = defensiveDeployments({ ...ctx, claims: null }, state, 13);
  assert.ok(ctx.claims!.guard.get(2)! > 1);
  assert.equal(ctx.claims!.guard.get(4), undefined);
  assert.ok(troopsOn(guarded, 2) > troopsOn(plain, 2));
  assert.ok(troopsOn(guarded, 4) < troopsOn(plain, 4));
});

test('the bot does not chase a continent a rival has all but won', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3, 4],
        [5, 6],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
      ],
      bonuses: [5, 1],
    },
    players: [1, 2],
    owners: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1 },
    troops: { 0: 8, 1: 8, 2: 8, 3: 8, 4: 3, 5: 3, 6: 3 },
  };
  const { ctx } = contextOf(spec);
  const kinds = gatherCandidates(ctx, snapshotState(ctx), 10).map(
    (candidate) => candidate.objectives[0].kind,
  );
  assert.ok(!kinds.includes('complete'));
  assert.ok(
    gatherCandidates({ ...ctx, claims: null }, snapshotState(ctx), 10).some(
      (candidate) => candidate.objectives[0].kind === 'complete',
    ),
  );
  const open = contextOf({
    ...spec,
    owners: { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 1, 6: 1 },
  }).ctx;
  assert.ok(
    gatherCandidates(open, snapshotState(open), 10).some(
      (candidate) => candidate.objectives[0].kind === 'complete',
    ),
  );
});

test('a claim is never both crushed and spoiled for the same player', () => {
  const { ctx } = contextOf({
    map: {
      continents: [
        [0, 1, 2, 3, 4],
        [5, 6],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
      ],
      bonuses: [5, 1],
    },
    players: [1, 2],
    owners: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1 },
    troops: { 0: 6, 1: 6, 2: 6, 3: 4, 4: 12, 5: 3, 6: 3 },
    troopsToDeploy: 10,
  });
  const candidates = gatherCandidates(ctx, snapshotState(ctx), 10);
  const pairs = (kind: string) =>
    candidates
      .filter((c) => c.objectives[0].kind === kind)
      .map(
        (c) =>
          `${c.objectives[0].continentId}:${c.objectives[0].targetPlayerId}`,
      );
  for (const pair of pairs('spoilContinent'))
    assert.ok(!pairs('crushClaim').includes(pair));
});

test('setup keeps a capital out of a rival continent but may spoil with a claim', () => {
  const spec: ScenarioSpec = {
    map: {
      continents: [
        [0, 1, 2, 3, 4, 5],
        [6, 7, 8],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
      ],
      bonuses: [20, 1],
    },
    players: [1, 2],
    owners: { 0: 2, 1: 2, 2: 2, 3: 2, 8: 1 },
    troops: { 0: 6, 1: 6, 2: 6, 3: 6 },
  };
  const choose = (turnPhase: Game['turnPhase']) => {
    const { game, botId } = buildGame({ ...spec, settings: { turnPhase } });
    return chooseTerritoryClaim(game, botId, 0, true);
  };
  assert.ok([6, 7].includes(choose('capital') ?? -1));
  assert.ok([4, 5].includes(choose('territory') ?? -1));
});

test('setup claims keep away from a continent a rival already leads', () => {
  const { game, botId } = buildGame({
    map: {
      continents: [
        [0, 1, 2],
        [3, 4, 5],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
      ],
      bonuses: [3, 3],
    },
    players: [1, 2],
    owners: { 0: 2, 1: 2 },
    troops: {},
  });
  assert.ok(
    [3, 4, 5].includes(chooseTerritoryClaim(game, botId, 0, true) ?? -1),
  );
});
