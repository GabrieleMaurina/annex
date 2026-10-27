import type { MapAspect, MapSize, OsmDetail, OsmGeneratedMap } from 'engine';
import type { WorldFrame } from './tileCover';

export const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

export interface WorldFocus {
  id: number;
  kind: string;
  name: string;
  lon: number;
  lat: number;
  population: number;
}

export interface WorldMapRequest {
  frame: WorldFrame;
  size: MapSize;
  aspect: MapAspect;
  detail: OsmDetail;
  seas: boolean;
  timed: boolean;
  name: string;
  focus: WorldFocus | null;
  cities: [string, number, number, number][];
}

export interface WorldMapProgress {
  stage: 'download' | 'build';
  done: number;
  total: number;
}

export type WorldMapReply =
  | ({ type: 'progress' } & WorldMapProgress)
  | { type: 'done'; map: OsmGeneratedMap }
  | { type: 'error'; error: string };
