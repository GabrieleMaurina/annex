import { useSyncExternalStore } from 'react';

let pulses = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pulseZombie(): void {
  pulses += 1;
  listeners.forEach((listener) => listener());
}

export function useZombiePulse(): number {
  return useSyncExternalStore(subscribe, () => pulses);
}
