import type {
  Fill,
  GenerateMapInput,
  GenerationType,
  LockedTile,
  MapSize,
  TileShape,
  TimedConnection,
} from '../lib/types';

export interface MapTerritory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface MapSeaTerritory {
  id: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface MapWrap {
  a: number;
  b: number;
  x: boolean;
  y: boolean;
}

export interface StoredMap {
  name: string;
  territories: MapTerritory[];
  seaTerritories: MapSeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
  timedConnections: TimedConnection[];
  lockedTiles: LockedTile[];
  image: string;
  imageMime: string;
  borderColors: string[];
  territoryNames: string[] | null;
  seaNames: string[] | null;
  continentNames: string[] | null;
}

export type PlayerMapSort =
  'mostLiked' | 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';

export interface PlayerMapsQuery {
  page: number;
  pageSize: number;
  q?: string;
  authorId?: string;
  mine?: boolean;
  liked?: boolean;
  notMine?: boolean;
  notLiked?: boolean;
  territoryMin?: number;
  territoryMax?: number;
  generationType?: GenerationType;
  generationFill?: Fill;
  generationSize?: MapSize;
  generationTile?: TileShape;
  generationSeas?: boolean;
  generationTimed?: boolean;
  generationUnlockable?: boolean;
  sort: PlayerMapSort;
}

export interface PlayerMapRow {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  territoryCount: number;
  continentCount: number;
  likeCount: number;
  liked: boolean;
  mine: boolean;
  dangerous: boolean;
  generation: GenerateMapInput | null;
  createdAt: number;
}

export interface PlayerMapsPage {
  maps: PlayerMapRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlayerMapDetail {
  id: string;
  name: string;
  authorId: string;
  territories: MapTerritory[];
  seaTerritories: MapSeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
  timedConnections: TimedConnection[];
  lockedTiles: LockedTile[];
  image: string;
  imageMime: string;
  borderColors: string[];
  territoryNames: string[] | null;
  seaNames: string[] | null;
  continentNames: string[] | null;
  generation: GenerateMapInput | null;
  dangerous: boolean;
  likeCount: number;
  mine: boolean;
  createdAt: number;
}

export interface PlayerMapSaveBody {
  name: string;
  territories: MapTerritory[];
  seaTerritories: MapSeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
  timedConnections: TimedConnection[];
  lockedTiles: LockedTile[];
  image: string;
  borderColors: string[];
  territoryNames: string[];
  seaNames: string[];
  continentNames: string[];
  generation: GenerateMapInput | null;
}

export type EarthMapInput = Omit<PlayerMapSaveBody, 'generation'>;
