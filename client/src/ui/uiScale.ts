import { useSyncExternalStore } from 'react';

export const MIN_UI_SCALE = 0.5;
export const MAX_UI_SCALE = 2;
export const DEFAULT_UI_SCALE = 1;

let uiScale = DEFAULT_UI_SCALE;
let fixedScale: number | null = null;
const listeners = new Set<() => void>();

export function getUiScale(): number {
  return fixedScale ?? uiScale;
}

export function withoutUiScale<T>(draw: () => T): T {
  fixedScale = DEFAULT_UI_SCALE;
  try {
    return draw();
  } finally {
    fixedScale = null;
  }
}

export function setUiScale(value: number): void {
  uiScale = Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, value));
  document.documentElement.style.fontSize = `${uiScale * 100}%`;
  document.documentElement.style.setProperty('--ui-scale', String(uiScale));
  listeners.forEach((listener) => listener());
}

function subscribeUiScale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUiScale(): number {
  return useSyncExternalStore(subscribeUiScale, () => uiScale);
}

export function scaled(px: number): string {
  return `calc(${px}px * var(--ui-scale, 1))`;
}
