import type { OsmGeneratedMap } from 'engine';
import type {
  CityLimitsRequest,
  WorldMapProgress,
  WorldMapReply,
  WorldMapRequest,
} from './worldTypes';

export interface WorldMapJob {
  promise: Promise<OsmGeneratedMap>;
  cancel: () => void;
}

function startWorker(): Worker {
  return new Worker(new URL('./osmWorker.ts', import.meta.url), {
    type: 'module',
  });
}

export function traceCityLimits(
  request: CityLimitsRequest,
): Promise<number[][]> {
  const worker = startWorker();
  return new Promise<number[][]>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<WorldMapReply>) => {
      const message = event.data;
      if (message.type === 'limits') resolve(message.rings);
      else if (message.type === 'error') reject(new Error(message.error));
    });
    worker.addEventListener('error', () =>
      reject(new Error('city limits failed')),
    );
    worker.postMessage(request);
  }).finally(() => worker.terminate());
}

export function generateWorldMap(
  request: Promise<WorldMapRequest>,
  onProgress: (progress: WorldMapProgress) => void,
): WorldMapJob {
  const worker = startWorker();
  let settle: ((error: Error | null, map?: OsmGeneratedMap) => void) | null =
    null;
  const promise = new Promise<OsmGeneratedMap>((resolve, reject) => {
    settle = (error, map) => {
      settle = null;
      worker.terminate();
      if (error) reject(error);
      else resolve(map!);
    };
  });
  worker.addEventListener('message', (event: MessageEvent<WorldMapReply>) => {
    const message = event.data;
    if (message.type === 'progress') onProgress(message);
    else if (message.type === 'done') settle?.(null, message.map);
    else if (message.type === 'error') settle?.(new Error(message.error));
  });
  worker.addEventListener('error', () =>
    settle?.(new Error('map generation failed')),
  );
  request.then((ready) => worker.postMessage(ready));
  return {
    promise,
    cancel: () => settle?.(new Error('cancelled')),
  };
}
