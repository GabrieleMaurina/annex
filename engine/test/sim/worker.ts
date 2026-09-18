import { parentPort, workerData } from 'node:worker_threads';
import { BotDifficulty, BotPersonality } from '../../src/types';
import { writeGameLog } from './logStore';
import { Bucket, BucketEntry } from './report';
import { runSimGame } from './runGame';

export interface WorkerInput {
  counter: SharedArrayBuffer;
  totalGames: number;
  roundCap: number;
  logDir: string;
}

export interface WorkerProgressMessage {
  type: 'progress';
}

export interface WorkerDoneMessage {
  type: 'done';
  points: BucketEntry[];
  planMs: [string, number[]][];
  dispatchFailures: number;
  finished: number;
  timedOut: number;
  settingsFailures: number;
}

export type WorkerMessage = WorkerProgressMessage | WorkerDoneMessage;

function key(personality: BotPersonality, difficulty: BotDifficulty): string {
  return `${personality}:${difficulty}`;
}

function main(): void {
  const input = workerData as WorkerInput;
  const counter = new Int32Array(input.counter);
  const points = new Map<string, Bucket>();
  const planMs = new Map<string, number[]>();
  let dispatchFailures = 0;
  let settingsFailures = 0;
  let finished = 0;
  let timedOut = 0;

  while (true) {
    const index = Atomics.add(counter, 0, 1);
    if (index >= input.totalGames) break;
    const seed = index + 1;
    const result = runSimGame(seed, input.roundCap);
    dispatchFailures += result.dispatchFailures;
    if (!result.settingsApplied) settingsFailures++;
    if (!result.truncated) finished++;
    if (result.timedOut) timedOut++;

    for (const ranked of result.points) {
      const k = key(ranked.identity.personality, ranked.identity.difficulty);
      const bucket = points.get(k) ?? { points: 0, count: 0 };
      bucket.points += ranked.points;
      bucket.count += 1;
      points.set(k, bucket);
    }
    for (const sample of result.planMsSamples) {
      const k = key(sample.identity.personality, sample.identity.difficulty);
      const arr = planMs.get(k) ?? [];
      arr.push(sample.ms);
      planMs.set(k, arr);
    }

    writeGameLog(input.logDir, result);
    parentPort?.postMessage({
      type: 'progress',
    } satisfies WorkerProgressMessage);
  }

  parentPort?.postMessage({
    type: 'done',
    points: [...points.entries()],
    planMs: [...planMs.entries()],
    dispatchFailures,
    finished,
    timedOut,
    settingsFailures,
  } satisfies WorkerDoneMessage);
}

main();
