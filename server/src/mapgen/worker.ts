import { parentPort } from 'worker_threads';
import { GenerateMapParams } from './core/params';
import { generateMap } from './generate';

parentPort!.on('message', (params: GenerateMapParams) => {
  try {
    parentPort!.postMessage({ ok: true, result: generateMap(params) });
  } catch (err) {
    parentPort!.postMessage({ ok: false, error: String(err) });
  }
});
