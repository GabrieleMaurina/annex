import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NEUTRAL_STACK_FOCUS,
  consolidation,
  spreading,
} from '../../src/bots/features/stackStyle';
import { evaluateBoard } from '../../src/bots/planning/board';
import {
  PlanContext,
  buildContext,
  cloneState,
  snapshotState,
} from '../../src/bots/planning/context';
import { buildTurnPlan } from '../../src/bots/planning/enumerate';
import { planBotTurn } from '../../src/bots/planning/planBotTurn';
import { defensiveDeployments } from '../../src/bots/planning/simulate';
import { BotDifficulty, BotPersonality } from '../../src/types';
import { mulberry32 } from '../sim/randomize';
import { ScenarioSpec, buildGame, replayBotTurn } from '../testkit';

const GRID_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [0, 3],
  [1, 4],
  [2, 5],
  [2, 6],
  [5, 9],
  [6, 7],
  [7, 8],
  [9, 10],
  [10, 11],
  [6, 9],
  [7, 10],
  [8, 11],
];

function grid(enemyTroops: Record<number, number>): ScenarioSpec {
  return {
    map: {
      continents: [
        [0, 1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10, 11],
      ],
      edges: GRID_EDGES,
      bonuses: [0, 0],
    },
    players: [1, 2],
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 1,
      6: 2,
      7: 2,
      8: 2,
      9: 2,
      10: 2,
      11: 2,
    },
    troops: { 2: 12, 5: 12, ...enemyTroops },
    troopsToDeploy: 6,
    difficulty: 'hard',
    cards: 'Off',
  };
}

const ENEMY_STACKED = { 6: 1, 7: 1, 8: 40, 9: 1, 10: 1, 11: 1 };
const ENEMY_SPREAD = { 6: 7, 7: 7, 8: 7, 9: 7, 10: 7, 11: 7 };

function contextFor(
  spec: ScenarioSpec,
  personality: BotPersonality = 'balanced',
  difficulty: BotDifficulty = 'hard',
): PlanContext {
  const { game, botId } = buildGame(spec);
  return buildContext(game, botId, { difficulty, personality }, null);
}

function deterministic<T>(run: () => T): T {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

test('neighbours sitting on one stack pull the bot toward stacking', () => {
  assert.equal(contextFor(grid(ENEMY_STACKED)).stackFocus, 1);
});

test('neighbours spreading their troops pull the bot toward spreading', () => {
  assert.equal(contextFor(grid(ENEMY_SPREAD)).stackFocus, 0);
});

test('neighbours with hardly any troops say nothing about style', () => {
  const focus = contextFor(
    grid({ 6: 1, 7: 2, 8: 1, 9: 2, 10: 1, 11: 1 }),
  ).stackFocus;
  assert.ok(Math.abs(focus - NEUTRAL_STACK_FOCUS) < 0.2);
});

test('only adaptive balanced bots follow their neighbours', () => {
  assert.equal(
    contextFor(grid(ENEMY_STACKED), 'killer').stackFocus,
    NEUTRAL_STACK_FOCUS,
  );
  assert.equal(
    contextFor(grid(ENEMY_STACKED), 'balanced', 'easy').stackFocus,
    NEUTRAL_STACK_FOCUS,
  );
  assert.equal(consolidation(NEUTRAL_STACK_FOCUS), 0);
  assert.equal(spreading(NEUTRAL_STACK_FOCUS), 0);
});

test('the style read at the start of the turn holds for the whole turn', () => {
  const { game, botId } = buildGame(grid(ENEMY_STACKED));
  const profile = { difficulty: 'hard', personality: 'balanced' } as const;
  const { plan } = deterministic(() => planBotTurn(game, botId, profile, null));
  assert.equal(plan.stackFocus, 1);
  for (const id of [6, 7, 8, 9, 10, 11]) game.territoryTroops.set(id, 7);
  assert.equal(buildContext(game, botId, profile, plan).stackFocus, 1);
  assert.equal(buildContext(game, botId, profile, null).stackFocus, 0);
});

test('stacking focus prefers one big stack, spreading focus covered borders', () => {
  const ctx = contextFor(grid(ENEMY_SPREAD));
  const split = snapshotState(ctx);
  const stacked = cloneState(split);
  stacked.troops.set(2, 23);
  stacked.troops.set(5, 1);
  const preference = (stackFocus: number) =>
    evaluateBoard({ ...ctx, stackFocus }, stacked) -
    evaluateBoard({ ...ctx, stackFocus }, split);
  assert.ok(preference(1) > preference(NEUTRAL_STACK_FOCUS));
  assert.ok(preference(NEUTRAL_STACK_FOCUS) > preference(0));
  assert.ok(preference(1) > 0);
});

test('a stacking bot deploys onto one stack and fortifies into it', () => {
  const ctx = contextFor(grid(ENEMY_SPREAD));
  const plan = deterministic(() => buildTurnPlan({ ...ctx, stackFocus: 1 }, 6));
  const deployedTo = new Set(plan.deployments.map((d) => d.territoryId));
  assert.equal(deployedTo.size, 1);
  if (plan.attackSteps.length === 0) {
    assert.ok(plan.fortify);
    assert.ok(deployedTo.has(plan.fortify.endId));
  }
});

function endOfTurnStackShare(seed: number): number {
  const originalRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    const { game, dispatchFailures } = replayBotTurn(grid(ENEMY_STACKED));
    assert.equal(dispatchFailures, 0);
    let excess = 0;
    let largest = 0;
    for (const [id, ownerId] of game.territoryOwners) {
      if (ownerId !== 1) continue;
      const troops = (game.territoryTroops.get(id) ?? 0) - 1;
      excess += troops;
      largest = Math.max(largest, troops);
    }
    return largest / excess;
  } finally {
    Math.random = originalRandom;
  }
}

test('next to a single stacker the bot ends its turn on a single stack', () => {
  const seeds = [1, 2, 3, 4];
  const share =
    seeds.reduce((sum, seed) => sum + endOfTurnStackShare(seed), 0) /
    seeds.length;
  assert.ok(share >= 0.85, `end of turn stack share ${share.toFixed(2)}`);
});

test('next to spreaders the bot guards more of its borders', () => {
  const edges: [number, number][] = [];
  const owners: Record<number, number> = { 0: 1 };
  const troops: Record<number, number> = {};
  for (let i = 1; i <= 6; i++) {
    edges.push([0, i], [i, i + 6]);
    owners[i] = 1;
    owners[i + 6] = 2;
    troops[i + 6] = 7;
  }
  const ctx = contextFor({
    map: {
      continents: [[0, ...Object.keys(troops).map(Number), 1, 2, 3, 4, 5, 6]],
      edges,
      bonuses: [0],
    },
    players: [1, 2],
    owners,
    troops,
    cards: 'Off',
  });
  const guarded = (stackFocus: number) =>
    defensiveDeployments({ ...ctx, stackFocus }, snapshotState(ctx), 12).length;
  assert.equal(guarded(NEUTRAL_STACK_FOCUS), 3);
  assert.equal(guarded(0), 6);
});
