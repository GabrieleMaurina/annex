import type { OsmGeneratedMap } from 'engine';
import type {
  WorldMapProgress,
  WorldMapReply,
  WorldMapRequest,
} from './worldTypes';

export interface WorldMapJob {
  promise: Promise<OsmGeneratedMap>;
  cancel: () => void;
}

export function generateWorldMap(
  request: WorldMapRequest,
  onProgress: (progress: WorldMapProgress) => void,
): WorldMapJob {
  const worker = new Worker(new URL('./osmWorker.ts', import.meta.url), {
    type: 'module',
  });
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
    else settle?.(new Error(message.error));
  });
  worker.addEventListener('error', () =>
    settle?.(new Error('map generation failed')),
  );
  worker.postMessage(request);
  return {
    promise,
    cancel: () => settle?.(new Error('cancelled')),
  };
}
