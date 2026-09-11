import type {
  Fill,
  GenerationType,
  MapSize,
  MapTerritory,
} from '../../lib/types';

export interface GenerateInput {
  seed: string;
  size: MapSize;
  type: GenerationType;
  fill: Fill;
}

export interface GeneratedEditorMap {
  name: string;
  territories: MapTerritory[];
  bonuses: number[];
  imageSrc: string;
}

type WorkerReply =
  { ok: true; result: GeneratedEditorMap } | { ok: false; error: string };

export function generateMap(input: GenerateInput): Promise<GeneratedEditorMap> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL(
        '../../connector/offline/workers/mapgenWorker.ts',
        import.meta.url,
      ),
      { type: 'module' },
    );
    worker.addEventListener('message', (e: MessageEvent) => {
      worker.terminate();
      const reply = e.data as WorkerReply;
      if (reply.ok) resolve(reply.result);
      else reject(new Error(reply.error));
    });
    worker.addEventListener('error', () => {
      worker.terminate();
      reject(new Error('map generation failed'));
    });
    worker.postMessage(input);
  });
}
