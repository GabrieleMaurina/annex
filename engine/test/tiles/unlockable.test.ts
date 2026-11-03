import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MapSpec, ScenarioSpec, planScenario, replayBotTurn } from '../testkit';

test('an isolated bot unlocks a bridge of locked tiles toward the enemy', () => {
  const map: MapSpec = {
    continents: [[0], [1]],
    edges: [],
    bonuses: [0, 0],
    lockedTiles: { 50: [0, 51], 51: [1, 50] },
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 1: 2 },
    troops: { 0: 20, 1: 1 },
    troopsToDeploy: 0,
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.deepEqual(
    [...replay.game.unlockedTileIds].sort((a, b) => a - b),
    [50, 51],
    'both tiles between the islands were unlocked open',
  );
  assert.equal(
    replay.game.territoryOwners.get(51),
    1,
    'the bot moved across the bridge it unlocked',
  );
});

test('a bot with an enemy in reach does not unlock tiles', () => {
  const map: MapSpec = {
    continents: [[0, 1], [2]],
    edges: [[0, 1]],
    bonuses: [0, 0],
    lockedTiles: { 50: [0, 2] },
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 1: 2, 2: 2 },
    troops: { 0: 20, 1: 30, 2: 1 },
    troopsToDeploy: 0,
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.equal(replay.game.unlockedTileIds.size, 0, 'no tile was unlocked');
});

test('a bot unlocks a bridge to break a weak enemy bonus it cannot reach', () => {
  const map: MapSpec = {
    continents: [[0, 5], [1], [3]],
    edges: [
      [0, 5],
      [5, 1],
    ],
    bonuses: [0, 0, 3],
    lockedTiles: { 50: [0, 3] },
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 5: 1, 1: 2, 3: 2 },
    troops: { 0: 15, 5: 2, 1: 20, 3: 1 },
    troopsToDeploy: 0,
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.ok(replay.game.unlockedTileIds.has(50), 'the tile was unlocked');
  assert.equal(
    replay.game.territoryOwners.get(3),
    1,
    'the bot crossed the tile and broke the bonus',
  );
});

test('a bot does not unlock a bridge that opens onto a big enemy stack', () => {
  const map: MapSpec = {
    continents: [[0, 5], [1], [3], [6]],
    edges: [
      [0, 5],
      [5, 1],
    ],
    bonuses: [0, 0, 3, 0],
    lockedTiles: { 50: [0, 3, 6] },
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 5: 1, 1: 2, 3: 2, 6: 2 },
    troops: { 0: 15, 5: 2, 1: 20, 3: 1, 6: 30 },
    troopsToDeploy: 0,
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.equal(replay.game.unlockedTileIds.size, 0, 'no tile was unlocked');
});

test('a cheap unlock into a safe tile is taken when it raises income', () => {
  const owned = Array.from({ length: 11 }, (_, id) => id);
  const map: MapSpec = {
    continents: [[...owned, 20]],
    edges: [
      ...owned.slice(1).map((id): [number, number] => [id - 1, id]),
      [10, 20],
    ],
    bonuses: [0],
    lockedTiles: { 50: [0] },
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { ...Object.fromEntries(owned.map((id) => [id, 1])), 20: 2 },
    troops: { 0: 10, 20: 5 },
    troopsToDeploy: 0,
    cards: 'linear',
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.equal(
    replay.game.territoryOwners.get(50),
    1,
    'the bot unlocked the tile and moved in',
  );
});

test('an expensive unlock into a safe tile is skipped', () => {
  const owned = Array.from({ length: 11 }, (_, id) => id);
  const map: MapSpec = {
    continents: [[...owned, 20]],
    edges: [
      ...owned.slice(1).map((id): [number, number] => [id - 1, id]),
      [10, 20],
    ],
    bonuses: [0],
    lockedTiles: { 50: [0] },
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { ...Object.fromEntries(owned.map((id) => [id, 1])), 20: 2 },
    troops: { 0: 10, 20: 5 },
    troopsToDeploy: 0,
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.equal(replay.game.unlockedTileIds.size, 0, 'no tile was unlocked');
});

test('a bot completes a bonus through a locked tile instead of a long detour', () => {
  const map: MapSpec = {
    continents: [
      [0, 1],
      [4, 6, 7],
    ],
    edges: [
      [0, 4],
      [4, 6],
      [6, 7],
      [7, 1],
    ],
    bonuses: [5, 0],
    lockedTiles: { 50: [0, 1] },
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2, 3],
    botId: 1,
    owners: { 0: 1, 1: 2, 4: 3, 6: 3, 7: 3 },
    troops: { 0: 20, 1: 1, 4: 3, 6: 3, 7: 3 },
    troopsToDeploy: 0,
  };

  const plan = planScenario(spec);
  assert.deepEqual(
    plan.attackSteps.slice(0, 2).map((step) => [step.startId, step.endId]),
    [
      [0, 50],
      [50, 1],
    ],
    'the plan routes through the locked tile',
  );

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.ok(replay.game.unlockedTileIds.has(50), 'the tile was unlocked');
  assert.equal(
    replay.game.territoryOwners.get(1),
    1,
    'the bot crossed the tile and completed the bonus',
  );
});
