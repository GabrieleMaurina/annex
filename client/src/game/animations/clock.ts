let virtualNow: number | null = null;

export function animationNow(): number {
  return virtualNow ?? performance.now();
}

export function isClockVirtual(): boolean {
  return virtualNow !== null;
}

export function atAnimationTime<T>(milliseconds: number, run: () => T): T {
  const saved = virtualNow;
  virtualNow = milliseconds;
  try {
    return run();
  } finally {
    virtualNow = saved;
  }
}
