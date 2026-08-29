import { WorkerPool, WorkerResult } from '../workers/workerPool';
import { GenerateMapParams } from './core/params';
import { GeneratedMap } from './generate';

const pool = new WorkerPool<GenerateMapParams, GeneratedMap>(
  __dirname,
  'worker',
  2,
);

export function generateMapAsync(
  params: GenerateMapParams,
  callback: (result: WorkerResult<GeneratedMap>) => void,
): void {
  pool.run(params, callback);
}
