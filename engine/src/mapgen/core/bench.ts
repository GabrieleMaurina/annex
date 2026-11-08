let sink: Record<string, number> | null = null;

export function startBench(): void {
  sink = {};
}

export function stopBench(): Record<string, number> {
  const result = sink ?? {};
  sink = null;
  return result;
}

let stepListener: (() => void) | null = null;

export function setStepListener(listener: (() => void) | null): void {
  stepListener = listener;
}

export function timeStep<T>(label: string, fn: () => T): T {
  const start = sink ? performance.now() : 0;
  const result = fn();
  if (sink) sink[label] = (sink[label] ?? 0) + (performance.now() - start);
  stepListener?.();
  return result;
}
