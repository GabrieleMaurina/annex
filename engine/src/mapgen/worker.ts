import { EngineWorkerScope } from '../workers/types';
import { GenerateMapParams } from './core/params';
import { trackProgress } from './core/progress';
import { generateMap } from './generate';

export function runMapgenWorker(scope: EngineWorkerScope): void {
  scope.onMessage((data) => {
    const params = data as GenerateMapParams;
    const stop = params.reportProgress
      ? trackProgress(params.type, (progress) =>
          scope.postMessage({ progress }),
        )
      : null;
    try {
      scope.postMessage({ ok: true, result: generateMap(params) });
    } catch (err) {
      scope.postMessage({ ok: false, error: String(err) });
    } finally {
      stop?.();
    }
  });
}
