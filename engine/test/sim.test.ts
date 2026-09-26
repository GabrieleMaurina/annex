import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeSummary } from './sim/logStore';
import { assertNoFailures, gamesFromEnv, runSimulation } from './sim/pool';
import {
  buildSummaryData,
  checkBalancedSuperiority,
  checkDifficultyOrdering,
  formatReport,
  mergeBuckets,
  mergePlanMs,
  percentile,
  StatFinding,
} from './sim/report';
import { WorkerDoneMessage } from './sim/worker';

const TOTAL_GAMES = gamesFromEnv('SIM');
const skip =
  TOTAL_GAMES > 0
    ? false
    : 'set SIM=<number of games> to run the simulation, e.g. SIM=200';

const PLAN_MS_P95_LIMIT = 200;
const MAX_FAILED_CHECK_RATIO = 1 / 3;

function assertMostChecksPass(label: string, findings: StatFinding[]): void {
  const failed = findings.filter((finding) => !finding.ok);
  assert.ok(
    failed.length <= findings.length * MAX_FAILED_CHECK_RATIO,
    `${failed.length}/${findings.length} ${label} checks failed:\n` +
      failed.map((finding) => finding.message).join('\n'),
  );
}

function verifyResults(results: WorkerDoneMessage[], logDir: string): void {
  const buckets = mergeBuckets(results.map((r) => r.points));
  const planMs = mergePlanMs(results.map((r) => r.planMs));
  const planMsAll = [...planMs.values()].flat();
  const dispatchFailures = results.reduce((s, r) => s + r.dispatchFailures, 0);
  const finished = results.reduce((s, r) => s + r.finished, 0);
  const timedOut = results.reduce((s, r) => s + r.timedOut, 0);

  const difficultyFindings = checkDifficultyOrdering(buckets);
  const balancedFindings = checkBalancedSuperiority(buckets);

  const reportInput = {
    totalGames: TOTAL_GAMES,
    finished,
    timedOut,
    dispatchFailures,
    buckets,
    planMsAll,
    difficultyFindings,
    balancedFindings,
  };

  console.log(formatReport(reportInput));
  writeSummary(logDir, buildSummaryData(reportInput));

  assertNoFailures(results);

  const planMsP95 = percentile(planMsAll, 0.95);
  assert.ok(
    planMsP95 < PLAN_MS_P95_LIMIT,
    `plan p95 ${planMsP95.toFixed(0)}ms exceeds ${PLAN_MS_P95_LIMIT}ms`,
  );

  assertMostChecksPass('difficulty ordering', difficultyFindings);
  assertMostChecksPass('balanced superiority', balancedFindings);
}

test('bot AI simulation across randomized games', { skip }, () =>
  runSimulation('simulation', TOTAL_GAMES, undefined, verifyResults),
);
