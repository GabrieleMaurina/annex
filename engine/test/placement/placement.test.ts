import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseCapital,
  chooseTerritoryClaim,
} from '../../src/bots/heuristics/misc';
import { defensiveBoldness } from '../../src/bots/personality/defensive';
import { planBotTurn } from '../../src/bots/planning/planBotTurn';
import { MapSpec, buildGame } from '../testkit';

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
