import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseCapital,
  chooseTerritoryClaim,
} from '../../src/bots/heuristics/misc';
import { defensiveBoldness } from '../../src/bots/personality/defensive';
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
  assert.equal(chooseTerritoryClaim(game, botId), 1);
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
