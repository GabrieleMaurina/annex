import { useSyncExternalStore } from 'react';
import { drawSmoothImage } from '../../../game/regions/smoothImage';

let smoothEdges = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setSmoothEdges(value: boolean) {
  smoothEdges = value;
  for (const listener of listeners) listener();
}

export function useSmoothEdges(): [boolean, (value: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => smoothEdges), setSmoothEdges];
}

export function drawSmoothPaint(
  ctx: CanvasRenderingContext2D,
  paintCanvas: HTMLCanvasElement,
  paintVersion: number | undefined,
  x: number,
  y: number,
  scale: number,
): boolean {
  return drawSmoothImage(
    ctx,
    {
      image: paintCanvas,
      revision: paintVersion ?? 0,
      tiles: null,
      fill: null,
    },
    x,
    y,
    scale,
  );
}
