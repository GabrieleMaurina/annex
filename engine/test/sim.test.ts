import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMixedBatch, setupSim } from './simCore';

const skip = process.env.SIM ? false : 'set SIM=1 to run the simulation';

test('difficulty ordering holds across a batch of games', { skip }, () => {
  setupSim();
  const batch = runMixedBatch(60, 90);

  assert.equal(
    batch.dispatchFailures,
    0,
    `${batch.dispatchFailures} dispatch failures across the batch`,
  );
  assert.ok(
    batch.finished / batch.games >= 0.95,
    `only ${batch.finished}/${batch.games} games finished`,
  );

  const { hard, medium, easy } = batch.shareByDifficulty;
  assert.ok(
    hard > medium,
    `hard territory share ${(100 * hard).toFixed(1)}% not above medium ${(100 * medium).toFixed(1)}%`,
  );
  assert.ok(
    medium > easy + 0.05,
    `medium territory share ${(100 * medium).toFixed(1)}% not clearly above easy ${(100 * easy).toFixed(1)}%`,
  );

  const cq = batch.conquestsByDifficulty;
  assert.ok(
    cq.hard >= cq.medium && cq.medium >= cq.easy,
    `conquests/turn not monotonic: ${JSON.stringify(cq)}`,
  );
});

test('plan compute time stays bounded', { skip }, () => {
  setupSim();
  const batch = runMixedBatch(30, 90);
  assert.ok(
    batch.planMsP95 < 200,
    `plan p95 ${batch.planMsP95.toFixed(0)}ms exceeds 200ms`,
  );
});
