import { runBotWorker } from 'engine';
import { parentPort } from 'worker_threads';

runBotWorker({
  postMessage: (data) => parentPort!.postMessage(data),
  onMessage: (handler) => parentPort!.on('message', handler),
});
