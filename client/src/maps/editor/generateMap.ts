import type {
  Fill,
  GenerationType,
  LockedTile,
  MapAspect,
  MapSeaTerritory,
  MapSize,
  MapTerritory,
  TileShape,
  TimedConnection,
} from '../../lib/types';

export interface GenerateInput {
  seed: string;
  size: MapSize;
  type: GenerationType;
  fill: Fill;
  tile: TileShape;
  seas: boolean;
  timed: boolean;
  unlockable: boolean;
  aspect: MapAspect;
  mountains: boolean;
  rivers: boolean;
}

export interface GeneratedNames {
  territoryNames: string[];
  seaNames: string[];
  continentNames: string[];
}

export interface GeneratedEditorMap {
  name: string;
  territories: MapTerritory[];
  seaTerritories: MapSeaTerritory[];
  bonuses: number[];
  timedConnections: TimedConnection[];
  lockedTiles: LockedTile[];
  imageSrc: string;
  borderColors: string[];
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
