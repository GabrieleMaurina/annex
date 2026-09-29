import { execSync } from 'child_process';
import * as fs from 'fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as path from 'path';
import { assertNoFailures, gamesFromEnv, runSimulation } from '../sim/pool';
import { versusDifficulty } from '../sim/randomize';
import { average, mergeBuckets } from '../sim/report';
import { WorkerDoneMessage } from '../sim/worker';

const TOTAL_GAMES = gamesFromEnv('VERSUS');
const BASE = process.env.BASE ?? 'HEAD';
const skip =
  TOTAL_GAMES > 0
    ? false
    : 'set VERSUS=<number of games> to compare balanced VERSUS_DIFFICULTY (default hard) against BASE=<commit> (default HEAD), e.g. VERSUS=200';

const ENGINE_DIR = path.join(__dirname, '..', '..');
const MIN_SCORE_RATIO = 0.95;
const CONFIDENCE_Z = 1.96;

function extractBaseline(sha: string): string {
  const baseDir = path.join(ENGINE_DIR, '.baseline', sha);
  const planner = path.join(baseDir, 'src', 'bots', 'planning');
  if (fs.existsSync(path.join(planner, 'planBotTurn.ts'))) return baseDir;
  fs.mkdirSync(baseDir, { recursive: true });
  const archive = path.join(baseDir, 'baseline.tar');
  execSync(`git archive --prefix=src/ -o "${archive}" ${sha}:engine/src`, {
    cwd: path.join(ENGINE_DIR, '..'),
  });
  execSync('tar -xf baseline.tar', { cwd: baseDir });
  fs.rmSync(archive);
  return baseDir;
}

function verifyResults(results: WorkerDoneMessage[], sha: string): void {
  const buckets = mergeBuckets(results.map((r) => r.points));
  const current = buckets.get('current');
  const baseline = buckets.get('baseline');
  const currentAvg = average(current);
  const baselineAvg = average(baseline);
  const diffs = results.flatMap((r) => r.versusDiffs);
  const meanDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const variance =
    diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) /
    Math.max(1, diffs.length - 1);
  const margin = CONFIDENCE_Z * Math.sqrt(variance / diffs.length);
  const ahead = diffs.filter((d) => d > 0).length / diffs.length;

  console.log(
    `== balanced ${versusDifficulty()}: current vs ${BASE} (${sha.slice(0, 7)}) ==`,
  );
  console.log(
    `  current  ${currentAvg.toFixed(2)} avg pts (n=${current?.count ?? 0})`,
  );
  console.log(
    `  baseline ${baselineAvg.toFixed(2)} avg pts (n=${baseline?.count ?? 0})`,
  );
  console.log(
    `  current scores ${((100 * currentAvg) / baselineAvg).toFixed(1)}% of baseline`,
  );
  console.log(
    `  current - baseline ${meanDiff >= 0 ? '+' : ''}${meanDiff.toFixed(2)} ± ${margin.toFixed(2)} pts (95% confidence, n=${diffs.length})`,
  );
  console.log(
    `  current finished ahead of baseline in ${(100 * ahead).toFixed(1)}% of games`,
  );

  assertNoFailures(results);
  assert.ok(
    currentAvg >= baselineAvg * MIN_SCORE_RATIO,
    `current balanced ${versusDifficulty()} (${currentAvg.toFixed(2)} avg pts) scores more than ` +
      `${Math.round(100 * (1 - MIN_SCORE_RATIO))}% below ${BASE} (${baselineAvg.toFixed(2)} avg pts)`,
  );
}

test('balanced versus previous version', { skip }, () => {
  const sha = execSync(`git rev-parse ${BASE}`, { encoding: 'utf8' }).trim();
  return runSimulation('versus', TOTAL_GAMES, extractBaseline(sha), (results) =>
    verifyResults(results, sha),
  );
});
