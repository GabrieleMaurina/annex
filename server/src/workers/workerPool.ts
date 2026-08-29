import path from 'path';
import { inspect } from 'util';
import { Worker } from 'worker_threads';

export type WorkerResult<TOut> =
  { ok: true; result: TOut } | { ok: false; error: string };

interface QueuedTask<TIn, TOut> {
  payload: TIn;
  callback: (result: WorkerResult<TOut>) => void;
}

const IS_TS_NODE = __filename.endsWith('.ts');

export class WorkerPool<TIn, TOut> {
  private scriptPath: string;
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private pending = new Map<Worker, (result: WorkerResult<TOut>) => void>();
  private queue: QueuedTask<TIn, TOut>[] = [];

  constructor(scriptDir: string, scriptBaseName: string, size: number) {
    this.scriptPath = path.join(
      scriptDir,
      `${scriptBaseName}.${IS_TS_NODE ? 'ts' : 'js'}`,
    );
    for (let i = 0; i < size; i++) this.spawn();
  }

  run(payload: TIn, callback: (result: WorkerResult<TOut>) => void): void {
    this.queue.push({ payload, callback });
    this.drainQueue();
  }

  private spawn(): void {
    const worker = new Worker(
      this.scriptPath,
      IS_TS_NODE
        ? {
            execArgv: ['-r', 'ts-node/register'],
            env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
          }
        : undefined,
    );
    worker.on('message', (result: WorkerResult<TOut>) => {
      this.settle(worker, result);
    });
    worker.on('error', (err) => {
      this.workers = this.workers.filter((w) => w !== worker);
      this.idle = this.idle.filter((w) => w !== worker);
      this.settle(worker, {
        ok: false,
        error: err instanceof Error ? (err.stack ?? err.message) : inspect(err),
      });
      this.spawn();
    });
    worker.on('exit', (code) => {
      if (!this.workers.includes(worker)) return;
      this.workers = this.workers.filter((w) => w !== worker);
      this.idle = this.idle.filter((w) => w !== worker);
      this.settle(worker, {
        ok: false,
        error: `worker exited with code ${code}`,
      });
      this.spawn();
    });
    this.workers.push(worker);
    this.idle.push(worker);
  }

  private settle(worker: Worker, result: WorkerResult<TOut>): void {
    const callback = this.pending.get(worker);
    this.pending.delete(worker);
    if (!this.idle.includes(worker) && this.workers.includes(worker))
      this.idle.push(worker);
    callback?.(result);
    this.drainQueue();
  }

  private drainQueue(): void {
    while (this.queue.length > 0 && this.idle.length > 0) {
      const worker = this.idle.pop()!;
      const task = this.queue.shift()!;
      this.pending.set(worker, task.callback);
      worker.postMessage(task.payload);
    }
  }
}
