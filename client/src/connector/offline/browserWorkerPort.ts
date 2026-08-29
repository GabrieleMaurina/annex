import type { EngineWorkerHandle } from 'engine';

export function browserWorkerPort(worker: Worker): EngineWorkerHandle {
  return {
    postMessage: (data) => worker.postMessage(data),
    onMessage: (handler) => {
      worker.addEventListener('message', (event) => handler(event.data));
    },
    onError: (handler) => {
      worker.addEventListener('error', (event) =>
        handler(event.error ?? event.message),
      );
    },
  };
}
