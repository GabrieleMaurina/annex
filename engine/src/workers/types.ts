export type WorkerResult<TOut> =
  { ok: true; result: TOut } | { ok: false; error: string };

export interface EngineWorkerHandle {
  postMessage(data: unknown): void;
  onMessage(handler: (data: unknown) => void): void;
  onError(handler: (error: unknown) => void): void;
}

export interface EngineWorkerScope {
  postMessage(data: unknown): void;
  onMessage(handler: (data: unknown) => void): void;
}

export type EngineWorkerFactory = () => EngineWorkerHandle;

export interface EngineWorkerConfigEntry {
  create: EngineWorkerFactory;
  poolSize?: number;
}

export interface EngineWorkerConfig {
  botWorker: EngineWorkerConfigEntry;
  mapgenWorker: EngineWorkerConfigEntry;
}
