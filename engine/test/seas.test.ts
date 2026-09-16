import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MapSpec, ScenarioSpec, planScenario, replayBotTurn } from './testkit';

test('the bot buys ships and conquers an island only reachable by sea', () => {
  const map: MapSpec = {
    continents: [[0], [1]],
    edges: [
      [0, 100],
      [1, 100],
    ],
    bonuses: [0, 0],
    seaIds: [100],
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 1: 2 },
    troops: { 0: 15, 1: 1 },
    troopsToDeploy: 6,
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.equal(
    replay.game.territoryOwners.get(1),
    1,
    'bot bought ships, bridged the sea, and conquered the island',
  );
});

test('the bot sails its fleet toward a sea threatened by an enemy fleet', () => {
  const map: MapSpec = {
    continents: [[0], [1]],
    edges: [
      [0, 100],
      [1, 100],
      [100, 101],
    ],
    bonuses: [0, 0],
    seaIds: [100, 101],
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 1: 2 },
    troops: { 0: 10, 1: 10 },
    troopsToDeploy: 0,
    seaShips: { 100: { 2: 20 }, 101: { 1: 5 } },
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.equal(
    replay.game.seaShips.get(100)?.get(1) ?? 0,
    5,
    'the fleet sailed from the rear sea to the threatened one',
  );
  assert.equal(
    replay.game.seaShips.get(101)?.get(1) ?? 0,
    0,
    'the rear sea was emptied by the move',
  );
});

test('the bot fights and clears an outnumbered enemy fleet', () => {
  const map: MapSpec = {
    continents: [[0], [1]],
    edges: [
      [0, 100],
      [1, 100],
    ],
    bonuses: [0, 0],
    seaIds: [100],
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 1: 2 },
    troops: { 0: 10, 1: 10 },
    troopsToDeploy: 0,
    seaShips: { 100: { 1: 5, 2: 1 } },
  };

  const replay = replayBotTurn(spec);

  assert.equal(replay.dispatchFailures, 0, 'no invalid actions along the way');
  assert.equal(
    replay.game.seaShips.get(100)?.get(2) ?? 0,
    0,
    'the outnumbered enemy fleet was wiped out',
  );
});

test('a route to an island reachable only by sea never targets the sea tile', () => {
  const map: MapSpec = {
    continents: [[0], [1, 2]],
    edges: [
      [0, 100],
      [100, 2],
      [1, 2],
    ],
    bonuses: [0, 5],
    seaIds: [100],
  };
  const spec: ScenarioSpec = {
    map,
    players: [1, 2],
    botId: 1,
    owners: { 0: 1, 1: 2, 2: 2 },
    troops: { 0: 20, 1: 5, 2: 5 },
    troopsToDeploy: 10,
  };

  const plan = planScenario(spec);
  for (const step of plan.attackSteps) {
    assert.notEqual(
      step.startId,
      100,
      'attack step must not start at a sea tile',
    );
    assert.notEqual(step.endId, 100, 'attack step must not target a sea tile');
  }
});
