import { EngineWorkerHandle } from 'engine';
import path from 'path';
import { Worker } from 'worker_threads';

const IS_TS_NODE = __filename.endsWith('.ts');

export function nodeWorkerPort(baseName: string): EngineWorkerHandle {
  const scriptPath = path.join(
    __dirname,
    `${baseName}.${IS_TS_NODE ? 'ts' : 'js'}`,
  );
  const worker = new Worker(
    scriptPath,
    IS_TS_NODE
      ? {
          execArgv: ['-r', 'ts-node/register'],
          env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
        }
      : undefined,
  );

  return {
    postMessage: (data) => worker.postMessage(data),
    onMessage: (handler) => worker.on('message', handler),
    onError: (handler) => {
      worker.on('error', handler);
      worker.on('exit', (code) => {
        if (code !== 0) handler(new Error(`worker exited with code ${code}`));
      });
    },
  };
}
