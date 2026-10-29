import type { MapAspect, MapSize, OsmDetail, OsmGeneratedMap } from 'engine';
import type { WorldFrame } from './tileCover';

export const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

export interface WorldFocus {
  kind: string;
  name: string;
  lon: number;
  lat: number;
  population: number;
  rings: number[][];
}

export interface WorldMapRequest {
  type: 'map';
  frame: WorldFrame;
  size: MapSize;
  aspect: MapAspect;
  detail: OsmDetail;
  seas: boolean;
  timed: boolean;
  mountains: boolean;
  rivers: boolean;
  name: string;
  focus: WorldFocus[];
  cities: [string, number, number, number][];
}

export interface CityLimitsRequest {
  type: 'limits';
  name: string;
  lon: number;
  lat: number;
  population: number;
  bounds: [number, number, number, number];
}

export type WorldWorkerRequest = WorldMapRequest | CityLimitsRequest;

export interface WorldMapProgress {
  stage: 'download' | 'build';
  done: number;
  total: number;
}

export type WorldMapReply =
  | ({ type: 'progress' } & WorldMapProgress)
  | { type: 'done'; map: OsmGeneratedMap }
  | { type: 'limits'; rings: number[][] }
  | { type: 'error'; error: string };
