import { BotDifficulty, BotPersonality } from '../../src/types';
import { DIFFICULTIES, PERSONALITIES } from './randomize';

export interface Bucket {
  points: number;
  count: number;
}
export type BucketEntry = [string, Bucket];
export type BucketMap = Map<string, Bucket>;

function key(personality: BotPersonality, difficulty: BotDifficulty): string {
  return `${personality}:${difficulty}`;
}

export function mergeBuckets(all: BucketEntry[][]): BucketMap {
  const merged: BucketMap = new Map();
  for (const entries of all)
    for (const [k, b] of entries) {
      const cur = merged.get(k) ?? { points: 0, count: 0 };
      cur.points += b.points;
      cur.count += b.count;
      merged.set(k, cur);
    }
  return merged;
}

export function mergePlanMs(
  all: [string, number[]][][],
): Map<string, number[]> {
  const merged = new Map<string, number[]>();
  for (const entries of all)
    for (const [k, arr] of entries) {
      const cur = merged.get(k);
      merged.set(k, cur ? cur.concat(arr) : arr);
    }
  return merged;
}

export function average(bucket: Bucket | undefined): number {
  return bucket && bucket.count > 0 ? bucket.points / bucket.count : 0;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export function maxValue(values: number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), 0);
}

export interface StatFinding {
  ok: boolean;
  message: string;
}

export function checkDifficultyOrdering(buckets: BucketMap): StatFinding[] {
  const findings: StatFinding[] = [];
  for (const personality of PERSONALITIES) {
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const lower = buckets.get(key(personality, DIFFICULTIES[i - 1]));
      const higher = buckets.get(key(personality, DIFFICULTIES[i]));
      if (!lower || !higher) continue;
      const lowerAvg = average(lower);
      const higherAvg = average(higher);
      findings.push({
        ok: higherAvg > lowerAvg,
        message:
          `${personality} ${DIFFICULTIES[i]} (${higherAvg.toFixed(2)} avg pts, n=${higher.count}) ` +
          `must score more than ${personality} ${DIFFICULTIES[i - 1]} ` +
          `(${lowerAvg.toFixed(2)} avg pts, n=${lower.count})`,
      });
    }
  }
  return findings;
}

export function checkBalancedSuperiority(buckets: BucketMap): StatFinding[] {
  const findings: StatFinding[] = [];
  for (const difficulty of DIFFICULTIES) {
    const balanced = buckets.get(key('balanced', difficulty));
    if (!balanced) continue;
    const balancedAvg = average(balanced);
    for (const personality of PERSONALITIES) {
      if (personality === 'balanced') continue;
      const other = buckets.get(key(personality, difficulty));
      if (!other) continue;
      const otherAvg = average(other);
      findings.push({
        ok: balancedAvg > otherAvg,
        message:
          `balanced ${difficulty} (${balancedAvg.toFixed(2)} avg pts, n=${balanced.count}) ` +
          `must score more than ${personality} ${difficulty} ` +
          `(${otherAvg.toFixed(2)} avg pts, n=${other.count})`,
      });
    }
  }
  return findings;
}

export interface ReportInput {
  totalGames: number;
  finished: number;
  timedOut: number;
  dispatchFailures: number;
  buckets: BucketMap;
  planMsAll: number[];
  difficultyFindings: StatFinding[];
  balancedFindings: StatFinding[];
}

export interface SummaryData {
  totalGames: number;
  finished: number;
  truncated: number;
  timedOut: number;
  dispatchFailures: number;
  points: {
    personality: BotPersonality;
    difficulty: BotDifficulty;
    avgPoints: number;
    count: number;
  }[];
  planMs: { p50: number; p95: number; max: number };
  difficultyOrderingChecks: StatFinding[];
  balancedSuperiorityChecks: StatFinding[];
}

export function buildSummaryData(input: ReportInput): SummaryData {
  const points: SummaryData['points'] = [];
  for (const personality of PERSONALITIES)
    for (const difficulty of DIFFICULTIES) {
      const bucket = input.buckets.get(key(personality, difficulty));
      if (!bucket) continue;
      points.push({
        personality,
        difficulty,
        avgPoints: average(bucket),
        count: bucket.count,
      });
    }
  return {
    totalGames: input.totalGames,
    finished: input.finished,
    truncated: input.totalGames - input.finished,
    timedOut: input.timedOut,
    dispatchFailures: input.dispatchFailures,
    points,
    planMs: {
      p50: percentile(input.planMsAll, 0.5),
      p95: percentile(input.planMsAll, 0.95),
      max: maxValue(input.planMsAll),
    },
    difficultyOrderingChecks: input.difficultyFindings,
    balancedSuperiorityChecks: input.balancedFindings,
  };
}

export function formatReport(input: ReportInput): string {
  const lines: string[] = [];
  lines.push('== bot AI simulation report ==');
  lines.push(
    `games: ${input.totalGames} | finished: ${input.finished} | truncated: ${input.totalGames - input.finished} | timed out: ${input.timedOut} | dispatch failures: ${input.dispatchFailures}`,
  );
  lines.push('');
  lines.push(
    'avg points by personality x difficulty (n = appearances, max 6):',
  );
  lines.push(['personality', ...DIFFICULTIES].join('\t'));
  for (const personality of PERSONALITIES) {
    const row: string[] = [personality];
    for (const difficulty of DIFFICULTIES) {
      const bucket = input.buckets.get(key(personality, difficulty));
      row.push(
        bucket ? `${average(bucket).toFixed(2)} (n=${bucket.count})` : 'n/a',
      );
    }
    lines.push(row.join('\t'));
  }
  lines.push('');
  lines.push(
    `plan time: p50 ${percentile(input.planMsAll, 0.5).toFixed(1)}ms | ` +
      `p95 ${percentile(input.planMsAll, 0.95).toFixed(1)}ms | ` +
      `max ${maxValue(input.planMsAll).toFixed(1)}ms`,
  );
  lines.push('');
  lines.push(
    'difficulty ordering checks (higher difficulty scores more, per personality):',
  );
  for (const f of input.difficultyFindings)
    lines.push(`  [${f.ok ? 'ok' : 'FAIL'}] ${f.message}`);
  if (input.difficultyFindings.length === 0)
    lines.push(
      '  (skipped: no games recorded yet for any personality/difficulty pair)',
    );
  lines.push('');
  lines.push(
    'balanced superiority checks (balanced beats every other personality, per difficulty):',
  );
  for (const f of input.balancedFindings)
    lines.push(`  [${f.ok ? 'ok' : 'FAIL'}] ${f.message}`);
  if (input.balancedFindings.length === 0)
    lines.push(
      '  (skipped: no games recorded yet for balanced at any difficulty)',
    );
  return lines.join('\n');
}
