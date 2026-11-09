import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crushClaimCandidates,
  punishCandidates,
} from '../../src/bots/claims/objectives';
import { recentPlacements } from '../../src/bots/claims/placements';
import {
  claimFactor,
  contestedShare,
  evaluateClaims,
} from '../../src/bots/claims/score';
import { chooseTerritoryClaim } from '../../src/bots/heuristics/misc';
import {
  PlanContext,
  buildContext,
  cloneState,
  snapshotState,
} from '../../src/bots/planning/context';
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
  const placed = recentPlacements(game, botId, continentOf).get(0)!;
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
    troops: { 4: 15, 5: 2, 6: 2, 7: 2 },
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
