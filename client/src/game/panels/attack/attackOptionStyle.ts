import type { CSSProperties } from 'react';

export function formatProbability(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

export function attackOptionStyle(selected: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px 8px',
    border: selected ? '2px solid currentColor' : '2px solid transparent',
    textAlign: 'center',
  };
}
