import { startBench, stopBench } from '../src/mapgen/core/bench';
import {
  Fill,
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_SIZE_VALUES,
  MapSize,
} from '../src/mapgen/core/params';
import { generateMap } from '../src/mapgen/generate';

const RUNS_PER_COMBO = 5;
const STEP_LABELS = [
  'shape',
  'partition',
  'geometry',
  'connectivity',
  'render',
];

interface RunResult {
  total: number;
  steps: Record<string, number>;
}

interface ComboResult {
  type: GenerationType;
  size: MapSize;
  fill: Fill;
  seas: boolean;
  avgTotal: number;
  avgSteps: Record<string, number>;
}

function runOnce(
  type: GenerationType,
  size: MapSize,
  fill: Fill,
  seas: boolean,
  seed: string,
): RunResult {
  startBench();
  const start = performance.now();
  generateMap({ seed, size, type, fill, seas });
  const total = performance.now() - start;
  const steps = stopBench();
  return { total, steps };
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function trimmedAverage(runs: RunResult[]): {
  avgTotal: number;
  avgSteps: Record<string, number>;
} {
  const sorted = [...runs].sort((a, b) => a.total - b.total);
  const kept = sorted.slice(1, -1);
  const avgTotal = average(kept.map((r) => r.total));
  const avgSteps: Record<string, number> = {};
  for (const label of STEP_LABELS) {
    avgSteps[label] = average(kept.map((r) => r.steps[label] ?? 0));
  }
  return { avgTotal, avgSteps };
}

function main(): void {
  const results: ComboResult[] = [];
  let comboIndex = 0;
  const totalCombos =
    GENERATION_TYPE_VALUES.length *
    MAP_SIZE_VALUES.length *
    FILL_VALUES.length *
    2;

  for (const type of GENERATION_TYPE_VALUES) {
    for (const size of MAP_SIZE_VALUES) {
      for (const fill of FILL_VALUES) {
        for (const seas of [false, true]) {
          comboIndex++;
          const runs: RunResult[] = [];
          for (let i = 0; i < RUNS_PER_COMBO; i++) {
            const seed = `bench::${type}::${size}::${fill}::${seas}::${i}`;
            runs.push(runOnce(type, size, fill, seas, seed));
          }
          const { avgTotal, avgSteps } = trimmedAverage(runs);
          results.push({ type, size, fill, seas, avgTotal, avgSteps });
          console.error(
            `[${comboIndex}/${totalCombos}] ${type} ${size} ${fill} seas=${seas} -> ${avgTotal.toFixed(1)}ms`,
          );
        }
      }
    }
  }

  const header = [
    'type',
    'size',
    'fill',
    'seas',
    'total_ms',
    ...STEP_LABELS.map((l) => `${l}_ms`),
  ];
  const lines = [header.join(',')];
  for (const r of results) {
    lines.push(
      [
        r.type,
        r.size,
        r.fill,
        r.seas,
        r.avgTotal.toFixed(2),
        ...STEP_LABELS.map((l) => r.avgSteps[l].toFixed(2)),
      ].join(','),
    );
  }
  console.log(lines.join('\n'));
}

main();
