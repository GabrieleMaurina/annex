import { runMapgenWorker } from 'engine';
import { parentPort } from 'worker_threads';

runMapgenWorker({
  postMessage: (data) => parentPort!.postMessage(data),
  onMessage: (handler) => parentPort!.on('message', handler),
});
