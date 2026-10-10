import { useSyncExternalStore, type SetStateAction } from 'react';
import type { Transform } from './helpers';

export interface Camera {
  get: () => Transform;
  set: (next: SetStateAction<Transform>) => void;
  subscribe: (listener: () => void) => () => void;
}

export const DEFAULT_TRANSFORM: Transform = { zoom: 1, offsetX: 0, offsetY: 0 };

export function createCamera(): Camera {
  let transform = DEFAULT_TRANSFORM;
  const listeners = new Set<() => void>();
  return {
    get: () => transform,
    set: (next) => {
      const value = typeof next === 'function' ? next(transform) : next;
      if (value === transform) return;
      transform = value;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useCameraTransform(camera: Camera): Transform {
  return useSyncExternalStore(camera.subscribe, camera.get);
}
