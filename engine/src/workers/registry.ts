import { EngineWorkerConfig, EngineWorkerConfigEntry } from './types';

let botWorker: EngineWorkerConfigEntry;
let mapgenWorker: EngineWorkerConfigEntry;

export function setWorkerConfig(config: EngineWorkerConfig): void {
  botWorker = config.botWorker;
  mapgenWorker = config.mapgenWorker;
}

export function getBotWorkerConfig(): EngineWorkerConfigEntry {
  return botWorker;
}

export function getMapgenWorkerConfig(): EngineWorkerConfigEntry {
  return mapgenWorker;
}
