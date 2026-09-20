import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NO_DUEL } from '../../src/bots/features/duel';
import { rollCandidates } from '../../src/bots/goals/duelObjectives';
import {
  openStackWeight,
  openedEnemyStackPower,
  stackReach,
  stackScores,
} from '../../src/bots/goals/stackOpenness';
import {
  applyEnemyResponse,
  evaluateBoard,
} from '../../src/bots/planning/board';
import {
  SimState,
  buildContext,
  cloneState,
  snapshotState,
} from '../../src/bots/planning/context';
import { planBotTurn } from '../../src/bots/planning/planBotTurn';
import {
  openStackDeployments,
  simulateTurn,
} from '../../src/bots/planning/simulate';
import { emptyPlan } from '../../src/bots/planning/turnPlan';
import { BotDifficulty, BotPersonality } from '../../src/types';
import { ScenarioSpec, buildGame, planScenario } from '../testkit';

function stackBoard(
  edges: [number, number][],
  owners: Record<number, number>,
  troops: Record<number, number>,
  players = [1, 2],
): ScenarioSpec {
  return {
    map: {
      continents: [[...new Set(edges.flat())]],
      edges,
      bonuses: [0],
    },
    players,
    owners,
    troops,
    troopsToDeploy: 10,
    difficulty: 'hard',
    cards: 'Off',
  };
}

function stackView(spec: ScenarioSpec, personality: BotPersonality) {
  const { game, botId } = buildGame(spec);
  const ctx = buildContext(
    game,
    botId,
    { difficulty: 'hard', personality },
    null,
  );
  return { game, botId, ctx, state: snapshotState(ctx) };
}

function reachOf(spec: ScenarioSpec, startId: number): Map<number, number> {
  const { ctx, state } = stackView(spec, 'killer');
  return stackReach(ctx, state, startId, state.troops.get(startId)! - 1);
}

function reachTotal(reach: Map<number, number>): number {
  return [...reach.values()].reduce((sum, value) => sum + value, 0);
}

function pendingConquest(spec: ScenarioSpec) {
  const { game, botId } = buildGame(spec);
  game.turnPhase = 'attack';
  game.troopsToDeploy = 0;
  game.attackStartTerritoryId = 0;
  game.attackEndTerritoryId = 1;
  game.attackConquestMinTroops = 3;
  return { game, botId };
}

test('a stack surrounded by its own territories is closed', () => {
  const closed = stackBoard(
    [
      [0, 1],
      [1, 2],
    ],
    { 0: 1, 1: 1, 2: 2 },
    { 0: 20, 1: 1, 2: 3 },
  );
  assert.equal(reachTotal(reachOf(closed, 0)), 0);
});

test('a stack is more open the more enemy territories it touches', () => {
  const partial = stackBoard(
    [
      [0, 1],
      [0, 2],
    ],
    { 0: 1, 1: 1, 2: 2 },
    { 0: 20, 1: 1, 2: 3 },
  );
  const wide = stackBoard(
    [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    { 0: 1, 1: 2, 2: 2, 3: 2, 4: 2 },
    { 0: 20, 1: 3, 2: 3, 3: 3, 4: 3 },
  );
  const partialReach = reachTotal(reachOf(partial, 0));
  assert.ok(partialReach > 0);
  assert.ok(reachTotal(reachOf(wide, 0)) > 2 * partialReach);
});

test('a stack can be open to one enemy player and closed to another', () => {
  const both = reachOf(
    stackBoard(
      [
        [0, 1],
        [0, 2],
      ],
      { 0: 1, 1: 2, 2: 3 },
      { 0: 20, 1: 3, 2: 3 },
      [1, 2, 3],
    ),
    0,
  );
  assert.ok((both.get(2) ?? 0) > 0);
  assert.ok((both.get(3) ?? 0) > 0);

  const shielded = reachOf(
    stackBoard(
      [
        [0, 1],
        [0, 2],
        [2, 3],
      ],
      { 0: 1, 1: 2, 2: 1, 3: 3 },
      { 0: 20, 1: 3, 2: 1, 3: 3 },
      [1, 2, 3],
    ),
    0,
  );
  assert.ok((shielded.get(2) ?? 0) > 0);
  assert.equal(shielded.get(3) ?? 0, 0);
});

test('a stack that cannot beat what it touches is barely open', () => {
  const fortress = stackBoard([[0, 1]], { 0: 1, 1: 2 }, { 0: 10, 1: 200 });
  const soft = stackBoard([[0, 1]], { 0: 1, 1: 2 }, { 0: 10, 1: 3 });
  assert.ok(reachTotal(reachOf(fortress, 0)) < 0.1);
  assert.ok(reachTotal(reachOf(soft, 0)) > 0.9);
});

test('an enemy stack only pressures the bot when it is open toward it', () => {
  const pressureOf = (spec: ScenarioSpec) => {
    const { ctx, state } = stackView(spec, 'balanced');
    return stackScores(ctx, state).pressure;
  };
  const open = stackBoard(
    [
      [0, 1],
      [1, 2],
    ],
    { 0: 1, 1: 2, 2: 2 },
    { 0: 10, 1: 40, 2: 3 },
  );
  const closed = stackBoard(
    [
      [0, 2],
      [2, 1],
    ],
    { 0: 1, 1: 2, 2: 2 },
    { 0: 10, 1: 40, 2: 3 },
  );
  const openToThirdPlayer = stackBoard(
    [
      [0, 2],
      [1, 2],
      [1, 3],
    ],
    { 0: 1, 1: 2, 2: 2, 3: 3 },
    { 0: 10, 1: 40, 2: 3, 3: 3 },
    [1, 2, 3],
  );
  assert.ok(pressureOf(open) > 0);
  assert.equal(pressureOf(closed), 0);
  assert.equal(pressureOf(openToThirdPlayer), 0);
});

test('conquering next to a closed enemy stack is what opens it', () => {
  const spec = stackBoard(
    [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    { 0: 1, 1: 2, 2: 2, 3: 2 },
    { 0: 20, 1: 4, 2: 40, 3: 3 },
  );
  const { ctx, state } = stackView(spec, 'balanced');
  assert.equal(openedEnemyStackPower(ctx, state, 1), 39);
  state.owners.set(1, ctx.botId);
  assert.equal(openedEnemyStackPower(ctx, state, 3), 0);
});

test('killer minds stack openness most, balanced next, defensive not at all', () => {
  const spec = stackBoard([[0, 1]], { 0: 1, 1: 2 }, { 0: 10, 1: 3 });
  const weightOf = (personality: BotPersonality) =>
    openStackWeight(stackView(spec, personality).ctx);
  assert.ok(weightOf('killer') > weightOf('balanced'));
  assert.ok(weightOf('balanced') > weightOf('taker'));
  assert.equal(weightOf('defensive'), 0);
});

test('a stack conquering a dead end stays on the open side', () => {
  const deadEnd = stackBoard(
    [
      [0, 1],
      [0, 2],
      [2, 3],
    ],
    { 0: 1, 1: 1, 2: 2, 3: 2 },
    { 0: 20, 1: 0, 2: 12, 3: 12 },
  );
  for (const personality of [
    'killer',
    'balanced',
    'defensive',
  ] as BotPersonality[]) {
    const { game, botId } = pendingConquest(deadEnd);
    const { actions } = planBotTurn(
      game,
      botId,
      { difficulty: 'hard', personality },
      null,
    );
    assert.deepEqual(
      actions.map((a) => a.payload),
      [{ troops: 3 }],
      personality,
    );
  }
});

test('a stack conquering its last hostile neighbour follows the front', () => {
  const frontier = stackBoard(
    [
      [0, 1],
      [1, 2],
    ],
    { 0: 1, 1: 1, 2: 2 },
    { 0: 20, 1: 0, 2: 12 },
  );
  const { game, botId } = pendingConquest(frontier);
  const { actions } = planBotTurn(
    game,
    botId,
    { difficulty: 'hard', personality: 'killer' },
    null,
  );
  assert.deepEqual(
    actions.map((a) => a.payload),
    [{ troops: 19 }],
  );
});

test('the planner expects the stack to stay open after a dead-end conquest', () => {
  const spec = stackBoard(
    [
      [0, 1],
      [0, 2],
    ],
    { 0: 1, 1: 2, 2: 2 },
    { 0: 20, 1: 2, 2: 12 },
  );
  const { ctx } = stackView(spec, 'killer');
  const result = simulateTurn(ctx, {
    objectives: [
      {
        kind: 'shrinkBorder',
        targetPlayerId: null,
        continentId: null,
        mustVisit: [1],
      },
    ],
    deployments: [],
    stacks: [{ startId: 0, route: [1], objectiveIndex: 0 }],
  });
  assert.equal(result.projected.owners.get(1), ctx.botId);
  assert.ok((result.projected.troops.get(0) ?? 0) >= 10);
  assert.ok((result.projected.troops.get(1) ?? 0) <= 2);
});

test('deployments stack onto the most open border for stack lovers only', () => {
  const spec = stackBoard(
    [
      [0, 1],
      [0, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 6],
    ],
    { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2 },
    { 0: 3, 1: 8, 2: 8, 3: 14, 4: 14, 5: 14, 6: 14 },
  );
  const killer = stackView(spec, 'killer');
  assert.deepEqual(openStackDeployments(killer.ctx, killer.state, 10), [
    { territoryId: 1, troops: 10 },
  ]);
  const defensive = stackView(spec, 'defensive');
  assert.deepEqual(
    openStackDeployments(defensive.ctx, defensive.state, 10),
    [],
  );
});

test('killer and balanced move a closed stack onto a front', () => {
  const closedStack = stackBoard(
    [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [2, 5],
      [2, 6],
    ],
    { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2 },
    { 0: 30, 1: 12, 2: 12, 3: 8, 4: 8, 5: 8, 6: 8 },
  );
  for (const personality of ['killer', 'balanced'] as BotPersonality[]) {
    const plan = planScenario({ ...closedStack, personality });
    assert.ok(plan.fortify, personality);
    assert.equal(plan.fortify.startId, 0, personality);
    assert.ok([1, 2].includes(plan.fortify.endId), personality);
  }
});

function twoBonusBoard(players: number[]): ScenarioSpec {
  return {
    map: {
      continents: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [2, 6],
        [6, 7],
        [7, 8],
        [5, 9],
      ],
      bonuses: [3, 4, 4, 1],
    },
    players,
    owners: {
      0: 1,
      1: 1,
      2: 1,
      3: 2,
      4: 2,
      5: 2,
      6: 2,
      7: 2,
      8: 2,
      9: players.length > 2 ? 3 : 2,
    },
    troops: { 0: 1, 1: 1, 2: 30, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 },
    troopsToDeploy: 12,
    cards: 'Off',
  };
}

function duelView(
  spec: ScenarioSpec,
  personality: BotPersonality,
  difficulty: BotDifficulty,
) {
  const { game, botId } = buildGame(spec);
  const ctx = buildContext(game, botId, { difficulty, personality }, null);
  return { ctx, state: snapshotState(ctx) };
}

function breakingWorth(
  players: number[],
  personality: BotPersonality,
  difficulty: BotDifficulty,
): number {
  const { ctx, state } = duelView(
    twoBonusBoard(players),
    personality,
    difficulty,
  );
  const before = evaluateBoard(ctx, state);
  state.owners.set(3, ctx.botId);
  return evaluateBoard(ctx, state) - before;
}

test('a duel needs exactly one opponent and scales with difficulty and personality', () => {
  const focusOf = (
    players: number[],
    personality: BotPersonality,
    difficulty: BotDifficulty,
  ) => duelView(twoBonusBoard(players), personality, difficulty).ctx.duel;
  assert.equal(focusOf([1, 2, 3], 'balanced', 'hard').breaking, 0);
  assert.equal(focusOf([1, 2], 'balanced', 'hard').breaking, 1);
  assert.ok(
    focusOf([1, 2], 'balanced', 'easy').breaking <
      focusOf([1, 2], 'balanced', 'medium').breaking,
  );
  assert.ok(
    focusOf([1, 2], 'balanced', 'medium').breaking <
      focusOf([1, 2], 'balanced', 'hard').breaking,
  );
  assert.equal(focusOf([1, 2], 'taker', 'hard').breaking, 0);
  assert.equal(focusOf([1, 2], 'balanced', 'idle').breaking, 0);
  assert.ok(
    focusOf([1, 2], 'killer', 'hard').rolling >
      focusOf([1, 2], 'killer', 'hard').breaking,
  );
});

test('in a duel breaking an opponent bonus is worth far more, except to a taker', () => {
  const duelBalanced = breakingWorth([1, 2], 'balanced', 'hard');
  assert.ok(duelBalanced > 2 * breakingWorth([1, 2, 3], 'balanced', 'hard'));
  assert.ok(duelBalanced > 2 * breakingWorth([1, 2], 'taker', 'hard'));
  assert.ok(duelBalanced > breakingWorth([1, 2], 'balanced', 'easy'));
});

test('in a duel the bot breaks every bonus the opponent holds, as far as its difficulty allows', () => {
  const brokenBy = (personality: BotPersonality, difficulty: BotDifficulty) => {
    const plan = planScenario({
      ...twoBonusBoard([1, 2]),
      personality,
      difficulty,
    });
    const ends = plan.attackSteps.map((step) => step.endId);
    return [3, 6].filter((id) => ends.includes(id)).length;
  };
  assert.equal(brokenBy('balanced', 'hard'), 2);
  assert.equal(brokenBy('breaker', 'hard'), 2);
  assert.equal(brokenBy('balanced', 'easy'), 1);
  assert.equal(brokenBy('taker', 'hard'), 1);
});

const matchedStacks: ScenarioSpec = {
  map: {
    continents: [[0, 1, 2, 3]],
    edges: [
      [0, 1],
      [0, 2],
      [2, 3],
    ],
    bonuses: [0],
  },
  players: [1, 2],
  owners: { 0: 1, 1: 1, 2: 2, 3: 2 },
  troops: { 0: 20, 1: 3, 2: 20, 3: 3 },
  troopsToDeploy: 4,
  cards: 'Off',
};

test('in a duel matched stacks get rolled, but only by bots that fight stacks', () => {
  const rolls = (
    spec: ScenarioSpec,
    personality: BotPersonality,
    budget = 4,
  ) => {
    const { ctx, state } = duelView(spec, personality, 'hard');
    return rollCandidates(ctx, state, budget).length;
  };
  assert.ok(rolls(matchedStacks, 'balanced') > 0);
  assert.ok(rolls(matchedStacks, 'killer') > 0);
  assert.equal(rolls(matchedStacks, 'taker'), 0);
  assert.equal(rolls(matchedStacks, 'defensive'), 0);
  assert.equal(
    rolls(
      {
        ...matchedStacks,
        players: [1, 2, 3],
        owners: { 0: 1, 1: 1, 2: 2, 3: 3 },
      },
      'balanced',
    ),
    0,
  );
});

test('a roll is not offered when the attacker advantage does not cover the gap', () => {
  const outmatched = {
    ...matchedStacks,
    troops: { 0: 10, 1: 3, 2: 30, 3: 3 },
    troopsToDeploy: 0,
  };
  const { ctx, state } = duelView(outmatched, 'balanced', 'hard');
  assert.equal(rollCandidates(ctx, state, 0).length, 0);
});

test('a duel makes stack openness matter more to balanced', () => {
  const weightIn = (players: number[]) =>
    openStackWeight(duelView(twoBonusBoard(players), 'balanced', 'hard').ctx);
  assert.ok(weightIn([1, 2]) > weightIn([1, 2, 3]));
});

function withTroops(state: SimState, troops: Record<number, number>): SimState {
  const copy = cloneState(state);
  for (const [id, count] of Object.entries(troops))
    copy.troops.set(Number(id), count);
  return copy;
}

test('the board score rewards an open own stack over a closed one, for stack lovers only', () => {
  const spec = stackBoard(
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    { 0: 2, 1: 1, 2: 1, 3: 1, 4: 3 },
    { 0: 3, 1: 1, 2: 1, 3: 30, 4: 3 },
    [1, 2, 3],
  );
  const openGap = (personality: BotPersonality, stack?: number) => {
    const { ctx, state } = stackView(spec, personality);
    const scoring = {
      ...ctx,
      weights: { ...ctx.weights, stack: stack ?? ctx.weights.stack },
    };
    const open = withTroops(state, { 1: 1, 2: 1, 3: 30 });
    const closed = withTroops(state, { 1: 1, 2: 30, 3: 1 });
    return evaluateBoard(scoring, open) - evaluateBoard(scoring, closed);
  };
  assert.ok(openGap('killer') > openGap('killer', -1));
  assert.ok(openGap('balanced') > openGap('balanced', -1));
  assert.equal(openGap('defensive'), openGap('defensive', -1));
});

test('the board score punishes an enemy stack that is open toward the bot', () => {
  const spec = stackBoard(
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    { 0: 1, 1: 2, 2: 2, 3: 2, 4: 3 },
    { 0: 45, 1: 3, 2: 3, 3: 3, 4: 3 },
    [1, 2, 3],
  );
  const { ctx, state } = stackView(spec, 'balanced');
  const open = withTroops(state, { 1: 40, 2: 3 });
  const closed = withTroops(state, { 1: 3, 2: 40 });
  assert.ok(evaluateBoard(ctx, open) < evaluateBoard(ctx, closed));
  const careless = { ...ctx, weights: { ...ctx.weights, defense: 0 } };
  assert.ok(
    evaluateBoard(ctx, closed) - evaluateBoard(ctx, open) >
      evaluateBoard(careless, closed) - evaluateBoard(careless, open),
  );
});

test('an attack that would open a big closed enemy stack is passed over', () => {
  const chosenEnd = (stackTroops: number) => {
    const spec = stackBoard(
      [
        [0, 1],
        [0, 2],
        [1, 3],
      ],
      { 0: 1, 1: 2, 2: 2, 3: 2 },
      { 0: 20, 1: 3, 2: 3, 3: stackTroops },
    );
    const { game, botId } = buildGame(spec);
    game.turnPhase = 'attack';
    game.troopsToDeploy = 0;
    const plan = emptyPlan(game.roundNumber, botId);
    plan.antiNukeDeployed = true;
    plan.nukeLaunched = true;
    const original = Math.random;
    Math.random = () => 0.5;
    try {
      const { actions } = planBotTurn(
        game,
        botId,
        { difficulty: 'hard', personality: 'balanced' },
        plan,
      );
      const end = actions.find((a) => a.event === 'game:attackSelectEnd');
      return (end?.payload as { territoryId: number }).territoryId;
    } finally {
      Math.random = original;
    }
  };
  assert.equal(chosenEnd(3), 1);
  assert.equal(chosenEnd(40), 2);
});

test('in a duel destroying an enemy stack is worth more than outside one', () => {
  const spec = stackBoard(
    [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    { 0: 1, 1: 2, 2: 2, 3: 2 },
    { 0: 5, 1: 30, 2: 3, 3: 3 },
  );
  const { ctx, state } = stackView(spec, 'balanced');
  const killWorth = (scoring: typeof ctx) =>
    evaluateBoard(scoring, withTroops(state, { 1: 2 })) -
    evaluateBoard(scoring, state);
  assert.ok(killWorth(ctx) > killWorth({ ...ctx, duel: NO_DUEL }));
});

test('in a duel the bot expects an equal enemy stack to roll it', () => {
  const ownerAfterResponse = (players: number[]) => {
    const spec = stackBoard(
      [
        [0, 1],
        [1, 2],
      ],
      { 0: 1, 1: 2, 2: players.length > 2 ? 3 : 2 },
      { 0: 20, 1: 22, 2: 3 },
      players,
    );
    const { ctx, state } = stackView(spec, 'balanced');
    return applyEnemyResponse(ctx, state).owners.get(0);
  };
  assert.equal(ownerAfterResponse([1, 2]), 2);
  assert.equal(ownerAfterResponse([1, 2, 3]), 1);
});
