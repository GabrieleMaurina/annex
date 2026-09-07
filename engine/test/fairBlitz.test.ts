import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fairBlitz,
  fairBlitzOutcomes,
  trueBlitz,
} from '../src/game/combat/dice';

const grid: [number, number, number][] = [
  [2, 1, 2],
  [5, 3, 2],
  [10, 8, 2],
  [20, 20, 2],
  [11, 10, 3],
  [6, 10, 3],
  [30, 4, 3],
  [3, 15, 2],
];

test('fairBlitz is deterministic', () => {
  for (const [a, d, dice] of grid)
    assert.deepEqual(fairBlitz(a, d, dice), fairBlitz(a, d, dice));
});

test('fairBlitz always wipes exactly one side', () => {
  for (const [a, d, dice] of grid) {
    const { attackLosses, defenceLosses } = fairBlitz(a, d, dice);
    const attackerWiped = attackLosses >= a;
    const defenderWiped = defenceLosses >= d;
    assert.notEqual(attackerWiped, defenderWiped);
    assert.ok(attackLosses >= 0 && attackLosses <= a);
    assert.ok(defenceLosses >= 0 && defenceLosses <= d);
  }
});

test('fairBlitz 3v1 costs the attacker one troop', () => {
  assert.deepEqual(fairBlitz(2, 1, 2), { attackLosses: 1, defenceLosses: 1 });
});

test('fairBlitzOutcomes matches fairBlitz row by row', () => {
  const outcomes = fairBlitzOutcomes(12, 8, 2);
  assert.equal(outcomes.length, 12);
  outcomes.forEach((outcome, i) =>
    assert.deepEqual(outcome, fairBlitz(i + 1, 8, 2)),
  );
});

test('fairBlitz tracks the long-run average of a true blitz', () => {
  const runs = 40000;
  for (const [a, d, dice] of grid) {
    let attackLosses = 0;
    let defenceLosses = 0;
    for (let i = 0; i < runs; i++) {
      const r = trueBlitz(a, d, dice);
      attackLosses += r.attackLosses;
      defenceLosses += r.defenceLosses;
    }
    const fair = fairBlitz(a, d, dice);
    const total = a + d;
    assert.ok(
      Math.abs(fair.attackLosses - attackLosses / runs) +
        Math.abs(fair.defenceLosses - defenceLosses / runs) <
        Math.max(2, total * 0.15),
    );
  }
});
