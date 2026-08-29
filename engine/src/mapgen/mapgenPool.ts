import { getMapgenWorkerConfig } from '../workers/registry';
import { WorkerResult } from '../workers/types';
import { WorkerPool } from '../workers/workerPool';
import { GenerateMapParams } from './core/params';
import { GeneratedMap } from './generate';

let pool: WorkerPool<GenerateMapParams, GeneratedMap> | null = null;

function getPool(): WorkerPool<GenerateMapParams, GeneratedMap> {
  if (!pool) {
    const config = getMapgenWorkerConfig();
    pool = new WorkerPool(config.create, config.poolSize ?? 1);
  }
  return pool;
}

export function generateMapAsync(
  params: GenerateMapParams,
  callback: (result: WorkerResult<GeneratedMap>) => void,
): void {
  getPool().run(params, callback);
}
