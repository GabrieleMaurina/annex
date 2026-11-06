import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseCapital,
  chooseTerritoryClaim,
} from '../../src/bots/heuristics/misc';
import { defensiveBoldness } from '../../src/bots/personality/defensive';
import { planBotTurn } from '../../src/bots/planning/planBotTurn';
import { heldContinentIds } from '../../src/game/mechanics';
import { Game } from '../../src/types';
import {
  MapSpec,
  ScenarioSpec,
  TurnReplay,
  buildGame,
  replayBotTurn,
} from '../testkit';

test('the capital guards the entrance of a bonus the bot holds', () => {
  const map: MapSpec = {
    continents: [
      [0, 1, 2],
      [3, 4, 5, 6, 7],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [3, 5],
      [3, 6],
      [3, 7],
    ],
    bonuses: [3, 0],
  };
  const { game, botId } = buildGame({
    map,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 2 },
    troops: {},
  });
  assert.equal(chooseCapital(game, botId), 2);
});

test('without a bonus to guard the capital sits on a central crossroads, not a corner', () => {
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
  assert.equal(chooseCapital(game, botId), 2);
});

test('territory claims build toward a continent the bot already started', () => {
  const map: MapSpec = {
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
  };
  const { game, botId } = buildGame({
    map,
    players: [1, 2],
    owners: { 0: 1, 3: 2 },
    troops: {},
  });
  assert.ok([1, 2].includes(chooseTerritoryClaim(game, botId, 0) ?? -1));
});

test('the first claim stakes out a quiet area away from rival claims', () => {
  const map: MapSpec = {
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
  };
  const { game, botId } = buildGame({
    map,
    players: [1, 2],
    owners: { 0: 2 },
    troops: {},
  });
  assert.ok([3, 4, 5].includes(chooseTerritoryClaim(game, botId, 0) ?? -1));
});

test('under fog a claim never lands on a hidden territory that is already taken', () => {
  const map: MapSpec = {
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
  };
  const { game, botId } = buildGame({
    map,
    players: [1, 2],
    owners: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2 },
    troops: {},
    settings: { fogOfWar: 'on', placement: 'single', turnPhase: 'territory' },
  });
  assert.equal(chooseTerritoryClaim(game, botId, 0), 5);
});

const SINGLE_START: MapSpec = {
  continents: [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12, 13],
    [14, 15, 16, 17, 18],
  ],
  edges: [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [2, 4],
    [3, 4],
    [4, 5],
    [5, 6],
    [5, 7],
    [6, 7],
    [6, 8],
    [7, 8],
    [8, 9],
    [9, 10],
    [9, 11],
    [10, 11],
    [10, 12],
    [11, 12],
    [11, 13],
    [12, 13],
    [13, 14],
    [14, 15],
    [14, 16],
    [15, 16],
    [15, 17],
    [16, 17],
    [16, 18],
    [17, 18],
  ],
  bonuses: [3, 2, 3, 3],
};

const SINGLE_SETTINGS: Partial<Game> = {
  placement: 'single',
  turnPhase: 'deploy',
  roundNumber: 1,
};

function singleStartTurn(overrides: Partial<ScenarioSpec>): TurnReplay {
  return replayBotTurn({
    map: SINGLE_START,
    players: [1, 2],
    owners: { 0: 1, 18: 2 },
    troops: { 0: 3, 18: 3 },
    troopsToDeploy: 3,
    settings: SINGLE_SETTINGS,
    ...overrides,
  });
}

function ownedBy(game: Game, playerId: number): number[] {
  return [...game.territoryOwners]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([id]) => id);
}

for (const difficulty of ['easy', 'medium', 'hard'] as const)
  for (const personality of [
    'balanced',
    'taker',
    'breaker',
    'killer',
    'vengeful',
    'defensive',
    'hoarder',
  ] as const)
    test(`single start: ${difficulty} ${personality} claims empty land while its rival is out of reach`, () => {
      const { game, dispatchFailures } = singleStartTurn({
        difficulty,
        personality,
      });
      assert.equal(dispatchFailures, 0);
      assert.ok(ownedBy(game, 1).length >= 2);
    });

test('single start: bots expand with no continent bonus on offer', () => {
  const { game } = singleStartTurn({
    settings: { ...SINGLE_SETTINGS, continents: 'off' },
  });
  assert.ok(ownedBy(game, 1).length >= 3);
});

test('single start: a bot reaching past a held continent keeps claiming land', () => {
  const owners: Record<number, number> = { 18: 2 };
  for (const id of [0, 1, 2]) owners[id] = 1;
  const { game } = singleStartTurn({
    owners,
    troops: { 0: 2, 1: 2, 2: 8, 18: 3 },
  });
  assert.ok(ownedBy(game, 1).length >= 5);
});

test('single start: a big army claims enough land for a bonus in one turn', () => {
  const { game } = singleStartTurn({
    troops: { 0: 20, 18: 3 },
    troopsToDeploy: 5,
  });
  assert.ok(heldContinentIds(game, 1).length >= 1);
});

test('single start: a hub surrounded by empty leaves claims more than one', () => {
  const { game } = replayBotTurn({
    map: {
      continents: [[0, 1, 2, 3, 4, 5, 6]],
      edges: [
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [0, 5],
        [5, 6],
      ],
      bonuses: [0],
    },
    players: [1, 2],
    owners: { 0: 1, 6: 2 },
    troops: { 0: 12, 6: 1 },
    troopsToDeploy: 3,
    settings: SINGLE_SETTINGS,
  });
  assert.ok(ownedBy(game, 1).length >= 3);
});

test('single start: under fog bots still claim the land they can see', () => {
  const { game } = singleStartTurn({
    settings: { ...SINGLE_SETTINGS, fogOfWar: 'on' },
  });
  assert.ok(ownedBy(game, 1).length >= 2);
});

test('single start: a bot claims land behind its chokepoint and brings the stack back', () => {
  const { game } = singleStartTurn({
    owners: { 4: 1, 5: 2 },
    troops: { 4: 12, 5: 14 },
  });
  assert.ok(ownedBy(game, 1).length >= 4);
  assert.ok((game.territoryTroops.get(4) ?? 0) >= 8);
});

test('single start: with no land left to claim a bot gathers at its front', () => {
  const { game } = singleStartTurn({
    owners: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2 },
    troops: { 0: 12, 4: 3, 5: 14 },
  });
  assert.deepEqual(ownedBy(game, 1).sort(), [0, 1, 2, 3, 4]);
  assert.ok((game.territoryTroops.get(4) ?? 0) >= 12);
});

test('defensive grows bolder only as its opponents fall', () => {
  const { game, botId } = buildGame({
    map: { continents: [[0]], edges: [], bonuses: [0] },
    players: [1, 2, 3, 4, 5, 6],
    owners: { 0: 1 },
    troops: {},
  });
  assert.equal(defensiveBoldness(game, botId, new Set()), 0);
  game.deathOrder = [2, 3];
  assert.equal(defensiveBoldness(game, botId, new Set()), 0.5);
  game.deathOrder = [2, 3, 4, 5];
  assert.equal(defensiveBoldness(game, botId, new Set()), 1);
});

test('initial troops go to the front and the home growth tile before the interior', () => {
  const map: MapSpec = {
    continents: [
      [0, 1, 2],
      [3, 4, 5],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [0, 3],
      [3, 4],
      [4, 5],
    ],
    bonuses: [4, 0],
  };
  const { game, botId } = buildGame({
    map,
    players: [1, 2],
    owners: { 0: 1, 1: 1, 3: 1, 4: 1, 2: 2, 5: 2 },
    troops: { 5: 6 },
    troopsToDeploy: 3,
    settings: {
      turnPhase: 'troop',
      roundNumber: 0,
      placementTroopPools: new Map([
        [1, 9],
        [2, 0],
      ]),
    },
  });
  const placed = new Set<number>();
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    for (let batch = 0; batch < 2; batch++) {
      const { actions } = planBotTurn(
        game,
        botId,
        { difficulty: 'hard', personality: 'balanced' },
        null,
      );
      const { territoryId, troops } = actions[0].payload as {
        territoryId: number;
        troops: number;
      };
      placed.add(territoryId);
      game.territoryTroops.set(
        territoryId,
        (game.territoryTroops.get(territoryId) ?? 0) + troops,
      );
      game.placementTroopPools.set(botId, 9 - 3 * (batch + 1));
    }
  } finally {
    Math.random = originalRandom;
  }
  assert.deepEqual([...placed].sort(), [1, 4]);
});
