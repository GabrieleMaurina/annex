import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseCapital,
  chooseTerritoryClaim,
} from '../../src/bots/heuristics/misc';
import { evaluateBoard } from '../../src/bots/planning/board';
import {
  PlanContext,
  buildContext,
  cloneState,
  snapshotState,
} from '../../src/bots/planning/context';
import { BotDifficulty, BotPersonality } from '../../src/types';
import { MapSpec, ScenarioSpec, buildGame } from '../testkit';

const LINE: MapSpec = {
  continents: [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
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
  bonuses: [3, 3, 3, 3],
};

const CORNER_AND_MIDDLE: MapSpec = {
  continents: [
    [0, 1],
    [2, 3],
    [4, 5],
  ],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ],
  bonuses: [3, 7, 1],
};

function deterministic<T>(work: () => T): T {
  const original = Math.random;
  Math.random = () => 0.5;
  try {
    return work();
  } finally {
    Math.random = original;
  }
}

function contextOf(
  spec: ScenarioSpec,
  difficulty: BotDifficulty = 'hard',
  personality: BotPersonality = 'balanced',
): PlanContext {
  const { game, botId } = buildGame(spec);
  return buildContext(game, botId, { difficulty, personality }, null);
}

const LINE_SPEC: ScenarioSpec = {
  map: LINE,
  players: [1, 2],
  owners: { 0: 1, 1: 1, 6: 2, 7: 2 },
  troops: {},
};

test('corner tiles are more remote than the middle and corner continents are safer', () => {
  const ctx = contextOf(LINE_SPEC);
  const { shape } = ctx.position!;
  assert.ok(shape.remoteness.get(0)! > shape.remoteness.get(3)!);
  assert.ok(shape.remoteness.get(7)! > shape.remoteness.get(4)!);
  assert.ok(shape.safety.get(0)! > shape.safety.get(1)!);
  assert.ok(shape.safety.get(3)! > shape.safety.get(2)!);
  assert.deepEqual([...shape.entries.get(0)!], [1]);
  assert.deepEqual([...shape.entries.get(1)!].sort(), [2, 3]);
});

test('the shape of identical maps is computed once and shared', () => {
  assert.equal(
    contextOf(LINE_SPEC).position!.shape,
    contextOf(LINE_SPEC).position!.shape,
  );
});

test('only balanced hard bots use map position', () => {
  assert.ok(contextOf(LINE_SPEC, 'hard', 'balanced').position);
  assert.equal(contextOf(LINE_SPEC, 'medium', 'balanced').position, null);
  assert.equal(contextOf(LINE_SPEC, 'easy', 'balanced').position, null);
  assert.equal(contextOf(LINE_SPEC, 'hard', 'taker').position, null);
});

test('the capital guards the entrance of the corner bonus rather than the central one', () => {
  const { game, botId } = buildGame({
    map: CORNER_AND_MIDDLE,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2 },
    troops: {},
  });
  assert.ok([2, 3].includes(chooseCapital(game, botId, false) ?? -1));
  assert.equal(chooseCapital(game, botId, true), 1);
});

test('without a corner bonus to guard the capital still sits on the central crossroads', () => {
  const map: MapSpec = {
    continents: [[0, 1, 2, 3, 4, 5, 6]],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [2, 6],
    ],
    bonuses: [0],
  };
  const { game, botId } = buildGame({
    map,
    players: [1, 2],
    owners: { 0: 1, 2: 1, 4: 1, 1: 2, 3: 2, 5: 2, 6: 2 },
    troops: { 0: 5, 4: 5 },
  });
  assert.equal(chooseCapital(game, botId, true), 2);
});

test('the first territory claim goes to a corner of the map', () => {
  const { game, botId } = buildGame({
    map: LINE,
    players: [1, 2],
    owners: {},
    troops: {},
    settings: { placement: 'single', turnPhase: 'territory' },
  });
  const claim = deterministic(() =>
    chooseTerritoryClaim(game, botId, 0, true, true),
  );
  assert.ok([0, 7].includes(claim ?? -1), `claimed ${claim}`);
});

test('a capital claimed on an empty map takes the entrance of a corner continent', () => {
  const { game, botId } = buildGame({
    map: LINE,
    players: [1, 2],
    owners: {},
    troops: {},
    settings: {
      placement: 'single',
      turnPhase: 'capital',
      gameMode: 'capitals',
    },
  });
  const claim = deterministic(() =>
    chooseTerritoryClaim(game, botId, 0, true, true),
  );
  assert.ok([1, 6].includes(claim ?? -1), `claimed ${claim}`);
});

test('borders facing a cornered player are guarded harder than borders facing a busy one', () => {
  const { guard } = contextOf({
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6]],
      edges: [
        [0, 1],
        [0, 2],
        [2, 3],
        [1, 4],
        [4, 5],
        [5, 6],
      ],
      bonuses: [0],
    },
    players: [1, 2, 3, 4],
    owners: { 0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4 },
    troops: {},
  }).position!;
  assert.ok(guard.get(0)! > guard.get(1)!);
});

test('holding a corner tile scores better than holding a central one', () => {
  const spec: ScenarioSpec = {
    map: LINE,
    players: [1, 2],
    owners: { 0: 1, 7: 2 },
    troops: { 0: 5, 7: 5 },
  };
  const ctx = contextOf(spec);
  const plain = { ...ctx, position: null };
  const corner = snapshotState(ctx);
  const middle = cloneState(corner);
  middle.owners.delete(0);
  middle.troops.delete(0);
  middle.owners.set(3, 1);
  middle.troops.set(3, 5);
  const gap = (c: PlanContext) =>
    evaluateBoard(c, corner) - evaluateBoard(c, middle);
  assert.ok(gap(ctx) > gap(plain));
});
