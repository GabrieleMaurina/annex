import { MapAspect, MapSize } from '../../core/params';
import { GeneratedMap } from '../../generate';

export type OsmDetail =
  | 'auto'
  | 'countries'
  | 'states'
  | 'counties'
  | 'municipalities'
  | 'districts'
  | 'neighbourhoods'
  | 'blocks';

export interface OsmFocus {
  rings: number[][];
  name: string;
  x: number;
  y: number;
  level: number;
  minArea: number;
}

export interface OsmLine {
  layer: string;
  cls: string;
  adminLevel: number;
  name: string;
  points: number[];
}

export interface OsmWater {
  cls: string;
  rings: number[][];
}

export interface OsmPlace {
  layer: string;
  cls: string;
  name: string;
  rank: number;
  capital: number;
  x: number;
  y: number;
}

export interface OsmFeatures {
  water: OsmWater[];
  landcover: OsmWater[];
  lines: OsmLine[];
  places: OsmPlace[];
}

export interface OsmMapParams {
  seed: string;
  size: MapSize;
  detail: OsmDetail;
  seas: boolean;
  timed: boolean;
  name: string;
  zoom: number;
  aspect: MapAspect;
  focus: OsmFocus | null;
  features: OsmFeatures;
}

export interface OsmGeneratedMap extends GeneratedMap {
  territoryNames: string[];
  seaNames: string[];
  continentNames: string[];
}
