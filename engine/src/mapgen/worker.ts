import { EngineWorkerScope } from '../workers/types';
import { GenerateMapParams } from './core/params';
import { generateMap } from './generate';

export function runMapgenWorker(scope: EngineWorkerScope): void {
  scope.onMessage((data) => {
    try {
      scope.postMessage({
        ok: true,
        result: generateMap(data as GenerateMapParams),
      });
    } catch (err) {
      scope.postMessage({ ok: false, error: String(err) });
    }
  });
}
