import { EngineWorkerFactory, EngineWorkerHandle, WorkerResult } from './types';

interface QueuedTask<TIn, TOut> {
  payload: TIn;
  callback: (result: WorkerResult<TOut>) => void;
}

export class WorkerPool<TIn, TOut> {
  private workers: EngineWorkerHandle[] = [];
  private idle: EngineWorkerHandle[] = [];
  private pending = new Map<
    EngineWorkerHandle,
    (result: WorkerResult<TOut>) => void
  >();
  private queue: QueuedTask<TIn, TOut>[] = [];

  constructor(
    private createWorker: EngineWorkerFactory,
    size: number,
  ) {
    for (let i = 0; i < size; i++) this.spawn();
  }

  run(payload: TIn, callback: (result: WorkerResult<TOut>) => void): void {
    this.queue.push({ payload, callback });
    this.drainQueue();
  }

  private spawn(): void {
    const worker = this.createWorker();
    worker.onMessage((data) => {
      this.settle(worker, data as WorkerResult<TOut>);
    });
    worker.onError((err) => {
      if (!this.workers.includes(worker)) return;
      this.workers = this.workers.filter((w) => w !== worker);
      this.idle = this.idle.filter((w) => w !== worker);
      this.settle(worker, {
        ok: false,
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      this.spawn();
    });
    this.workers.push(worker);
    this.idle.push(worker);
  }

  private settle(worker: EngineWorkerHandle, result: WorkerResult<TOut>): void {
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
