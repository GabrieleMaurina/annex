import type { EngineWorkerScope } from 'engine';

interface DedicatedWorker {
  postMessage(data: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void;
}

export function workerScope(): EngineWorkerScope {
  const ctx = self as unknown as DedicatedWorker;
  return {
    postMessage: (data) => ctx.postMessage(data),
    onMessage: (handler) => {
      ctx.addEventListener('message', (event) => handler(event.data));
    },
  };
}
