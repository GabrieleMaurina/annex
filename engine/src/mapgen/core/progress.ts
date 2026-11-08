import { setStepListener } from './bench';
import { GenerationType } from './params';

const STEP_WEIGHTS: Record<GenerationType, number[]> = {
  terrain: [66, 14, 3, 7, 10],
  tile: [4, 3, 52, 13, 12, 1, 15],
  dungeon: [2, 4, 38, 15, 17, 1, 24],
  temple: [9, 4, 38, 17, 9, 1, 24],
};

export function trackProgress(
  type: GenerationType,
  report: (fraction: number) => void,
): () => void {
  const weights = STEP_WEIGHTS[type];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let done = 0;
  let step = 0;
  report(0);
  setStepListener(() => {
    done += weights[step++] ?? 0;
    report(Math.min(1, done / total));
  });
  return () => setStepListener(null);
}
