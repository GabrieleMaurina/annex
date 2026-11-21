import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attackWinProbability } from '../../src/bots/features/combat';
import { zombieThreat } from '../../src/bots/zombie/forecast';
import {
  nextGrowthStep,
  troopsFor,
  zombieGrowth,
} from '../../src/bots/zombie/growth';
import { spreadTroops } from '../../src/bots/zombie/spread';
import { pickZombieAttack } from '../../src/bots/zombie/targets';
import { EngineCallbacks, setCallbacks } from '../../src/callbacks';
import { attackDiceFor, diceTiesFor } from '../../src/game/combat/dice';
import { ScenarioSpec, buildGame } from '../testkit';

const STAR: ScenarioSpec = {
  map: {
    continents: [[0, 1, 2, 3]],
    edges: [
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    bonuses: [0],
  },
  players: [1, 2, 3],
  owners: { 0: 1, 1: 2, 2: 3, 3: 2 },
  troops: { 0: 20, 1: 5, 2: 10, 3: 11 },
  settings: { zombieId: 1 },
};

test('Zombies attack the biggest territory they can still double', () => {
  const { game } = buildGame(STAR);
  assert.deepEqual(pickZombieAttack(game), { startId: 0, endId: 2 });
});

test('Zombies pick randomly among equally big targets', () => {
  const { game } = buildGame({
    ...STAR,
    troops: { 0: 20, 1: 8, 2: 8, 3: 11 },
  });
  const picked = new Set<number>();
  for (let i = 0; i < 200; i++) picked.add(pickZombieAttack(game)!.endId);
  assert.deepEqual([...picked].sort(), [1, 2]);
});

test('Zombies do not attack territories above half their stack', () => {
  const { game } = buildGame({
    ...STAR,
    troops: { 0: 9, 1: 5, 2: 10, 3: 11 },
  });
  assert.equal(pickZombieAttack(game), null);
});

test('Zombies attack with one die fewer and lose ties when defending', () => {
  const { game } = buildGame(STAR);
  assert.equal(attackDiceFor(game, 0), game.attackDice - 1);
  assert.equal(attackDiceFor(game, 1), game.attackDice);
  assert.equal(diceTiesFor(game, 0), 'attack');
  assert.equal(diceTiesFor(game, 1), game.diceTies);
});

test('Zombie growth follows the troop share thresholds', () => {
  assert.deepEqual(zombieGrowth(0.3, 0), { type: 'percent', percent: 60 });
  assert.deepEqual(zombieGrowth(0.3, 1), { type: 'percent', percent: 75 });
  assert.deepEqual(zombieGrowth(0.3, 9), { type: 'percent', percent: 150 });
  assert.deepEqual(zombieGrowth(0.45, 3), { type: 'flat', troops: 3 });
  assert.deepEqual(zombieGrowth(0.52, 3), { type: 'flat', troops: 2 });
  assert.deepEqual(zombieGrowth(0.6, 3), { type: 'flat', troops: 1 });
});

test('Zombie growth climbs each turn and resets after the cap', () => {
  const first = zombieGrowth(0.3, 0);
  assert.equal(nextGrowthStep(first, 0), 1);
  assert.equal(nextGrowthStep(zombieGrowth(0.3, 6), 6), 0);
  assert.equal(nextGrowthStep(zombieGrowth(0.5, 4), 4), 0);
  assert.equal(troopsFor({ type: 'percent', percent: 75 }, 5), 4);
  assert.equal(troopsFor({ type: 'flat', troops: 2 }, 50), 2);
});

test('Zombie neighbours threaten only up to half of their grown stack', () => {
  const { game } = buildGame(STAR);
  game.roundNumber = 5;
  assert.equal(zombieThreat(game, 20), 12);
});

test('Bots rate attacks on zombie territory higher because ties favour them', () => {
  const { game } = buildGame(STAR);
  const onZombie = attackWinProbability(
    game,
    10,
    10,
    game.defenceDice,
    game.attackDice,
    diceTiesFor(game, 0),
  );
  const onPlayer = attackWinProbability(
    game,
    10,
    10,
    game.defenceDice,
    game.attackDice,
    diceTiesFor(game, 1),
  );
  assert.ok(onZombie > onPlayer);
});

test('Zombies even out their troops over connected territories', () => {
  setCallbacks(
    new Proxy({}, { get: () => () => undefined }) as EngineCallbacks,
  );
  const { game } = buildGame({
    ...STAR,
    owners: { 0: 1, 1: 1, 2: 1, 3: 2 },
    troops: { 0: 10, 1: 1, 2: 1, 3: 7 },
  });
  spreadTroops(game);
  const troops = [0, 1, 2].map((id) => game.territoryTroops.get(id));
  assert.deepEqual(troops.sort(), [4, 4, 4]);
  assert.equal(game.territoryTroops.get(3), 7);
});
