import * as fs from 'fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Worker } from 'node:worker_threads';
import * as os from 'os';
import * as path from 'path';
import { writeSummary } from './sim/logStore';
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
import { WorkerDoneMessage, WorkerInput, WorkerMessage } from './sim/worker';

const TOTAL_GAMES = Number(process.env.SIM ?? 0);
const skip =
  Number.isInteger(TOTAL_GAMES) && TOTAL_GAMES > 0
    ? false
    : 'set SIM=<number of games> to run the simulation, e.g. SIM=200';

const ROUND_CAP = 1000;
const PLAN_MS_P95_LIMIT = 200;
const MAX_FAILED_CHECK_RATIO = 1 / 3;

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function assertMostChecksPass(label: string, findings: StatFinding[]): void {
  const failed = findings.filter((finding) => !finding.ok);
  assert.ok(
    failed.length <= findings.length * MAX_FAILED_CHECK_RATIO,
    `${failed.length}/${findings.length} ${label} checks failed:\n` +
      failed.map((finding) => finding.message).join('\n'),
  );
}

function verifyResults(
  results: WorkerDoneMessage[],
  logDir: string,
  startTime: number,
): void {
  const buckets = mergeBuckets(results.map((r) => r.points));
  const planMs = mergePlanMs(results.map((r) => r.planMs));
  const planMsAll = [...planMs.values()].flat();
  const dispatchFailures = results.reduce((s, r) => s + r.dispatchFailures, 0);
  const settingsFailures = results.reduce((s, r) => s + r.settingsFailures, 0);
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
  console.log(
    `simulation took ${formatDuration(Date.now() - startTime)} in total`,
  );

  assert.equal(
    settingsFailures,
    0,
    `${settingsFailures} game(s) had a setting combination rejected by updateSettings`,
  );

  const planMsP95 = percentile(planMsAll, 0.95);
  assert.ok(
    planMsP95 < PLAN_MS_P95_LIMIT,
    `plan p95 ${planMsP95.toFixed(0)}ms exceeds ${PLAN_MS_P95_LIMIT}ms`,
  );

  assertMostChecksPass('difficulty ordering', difficultyFindings);
  assertMostChecksPass('balanced superiority', balancedFindings);
}

test('bot AI simulation across randomized games', { skip }, () => {
  const startTime = Date.now();
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.join(__dirname, '..', '.sim-logs', runId);
  fs.mkdirSync(logDir, { recursive: true });

  const workerCount = Math.max(1, Math.min(os.cpus().length, TOTAL_GAMES));
  const counter = new SharedArrayBuffer(4);
  new Int32Array(counter).fill(0);

  console.log(
    `running ${TOTAL_GAMES} games across ${workerCount} worker(s), round cap ${ROUND_CAP}...`,
  );
  console.log(`logs: ${logDir}`);

  let completed = 0;
  const progressStep = Math.max(1, Math.floor(TOTAL_GAMES / 20));
  let nextProgressPrint = progressStep;

  const results = Promise.all(
    Array.from({ length: workerCount }, () => {
      const worker = new Worker(path.join(__dirname, 'sim', 'worker.ts'), {
        execArgv: ['--require', 'ts-node/register'],
        workerData: {
          counter,
          totalGames: TOTAL_GAMES,
          roundCap: ROUND_CAP,
          logDir,
        } satisfies WorkerInput,
      });
      return new Promise<WorkerDoneMessage>((resolve, reject) => {
        worker.on('message', (msg: WorkerMessage) => {
          if (msg.type === 'progress') {
            completed++;
            if (completed >= nextProgressPrint) {
              nextProgressPrint += progressStep;
              const elapsed = Date.now() - startTime;
              const expectedTotal = (elapsed / completed) * TOTAL_GAMES;
              console.log(
                `  ${completed}/${TOTAL_GAMES} games done, expected remaining ${formatDuration(expectedTotal - elapsed)}, expected total ${formatDuration(expectedTotal)}`,
              );
            }
          } else {
            resolve(msg);
          }
        });
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0)
            reject(new Error(`sim worker exited with code ${code}`));
        });
      });
    }),
  );

  return results.then((done) => verifyResults(done, logDir, startTime));
});
