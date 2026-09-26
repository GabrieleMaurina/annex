import * as fs from 'fs';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import * as os from 'os';
import * as path from 'path';
import { WorkerDoneMessage, WorkerInput, WorkerMessage } from './worker';

const ROUND_CAP = 1000;

export function gamesFromEnv(name: string): number {
  const games = Number(process.env[name] ?? 0);
  return Number.isInteger(games) && games > 0 ? games : 0;
}

export function assertNoFailures(results: WorkerDoneMessage[]): void {
  const settingsFailures = results.reduce((s, r) => s + r.settingsFailures, 0);
  const dispatchFailures = results.reduce((s, r) => s + r.dispatchFailures, 0);
  assert.equal(
    settingsFailures,
    0,
    `${settingsFailures} game(s) had a setting combination rejected by updateSettings`,
  );
  assert.equal(
    dispatchFailures,
    0,
    `${dispatchFailures} bot action(s) were rejected by dispatchBotAction`,
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function runWorkers(
  input: Omit<WorkerInput, 'counter'>,
  startTime: number,
): Promise<WorkerDoneMessage[]> {
  const totalGames = input.totalGames;
  const workerCount = Math.max(1, Math.min(os.cpus().length, totalGames));
  const counter = new SharedArrayBuffer(4);
  new Int32Array(counter).fill(0);

  console.log(
    `running ${totalGames} games across ${workerCount} worker(s), round cap ${input.roundCap}...`,
  );
  console.log(`logs: ${input.logDir}`);

  let completed = 0;
  const progressStep = Math.max(1, Math.floor(totalGames / 20));
  let nextProgressPrint = progressStep;

  return Promise.all(
    Array.from({ length: workerCount }, () => {
      const worker = new Worker(path.join(__dirname, 'worker.ts'), {
        execArgv: ['--require', 'ts-node/register'],
        workerData: { ...input, counter } satisfies WorkerInput,
      });
      return new Promise<WorkerDoneMessage>((resolve, reject) => {
        worker.on('message', (msg: WorkerMessage) => {
          if (msg.type === 'progress') {
            completed++;
            if (completed >= nextProgressPrint) {
              nextProgressPrint += progressStep;
              const elapsed = Date.now() - startTime;
              const expectedTotal = (elapsed / completed) * totalGames;
              console.log(
                `  ${completed}/${totalGames} games done, expected remaining ${formatDuration(expectedTotal - elapsed)}, expected total ${formatDuration(expectedTotal)}`,
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
}

export function runSimulation(
  label: string,
  totalGames: number,
  baseDir: string | undefined,
  verify: (results: WorkerDoneMessage[], logDir: string) => void,
): Promise<void> {
  const startTime = Date.now();
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.join(__dirname, '..', '..', '.sim-logs', runId);
  fs.mkdirSync(logDir, { recursive: true });

  return runWorkers(
    { totalGames, roundCap: ROUND_CAP, logDir, baseDir },
    startTime,
  ).then((results) => {
    console.log(
      `${label} took ${formatDuration(Date.now() - startTime)} in total`,
    );
    verify(results, logDir);
  });
}
