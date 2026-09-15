let sink: Record<string, number> | null = null;

export function startBench(): void {
  sink = {};
}

export function stopBench(): Record<string, number> {
  const result = sink ?? {};
  sink = null;
  return result;
}

export function timeStep<T>(label: string, fn: () => T): T {
  if (!sink) return fn();
  const start = performance.now();
  const result = fn();
  sink[label] = (sink[label] ?? 0) + (performance.now() - start);
  return result;
}
