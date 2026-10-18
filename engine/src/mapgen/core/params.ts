export type MapSize = 'small' | 'medium' | 'large' | 'xlarge';
export type Fill = 'full' | 'mixed' | 'sparse';
export type GenerationType = 'terrain' | 'dungeon' | 'temple' | 'tile';
export type TileShape =
  'triangles' | 'squares' | 'hexagons' | 'octares' | 'hexgles' | 'squagles';

export interface GenerateMapParams {
  seed: string;
  size: MapSize;
  type: GenerationType;
  fill: Fill;
  tile: TileShape;
  seas: boolean;
  timed: boolean;
}

export const MAP_SIZE_VALUES: MapSize[] = [
  'small',
  'medium',
  'large',
  'xlarge',
];
export const FILL_VALUES: Fill[] = ['full', 'mixed', 'sparse'];
export const GENERATION_TYPE_VALUES: GenerationType[] = [
  'terrain',
  'dungeon',
  'temple',
  'tile',
];
export const TILE_SHAPE_VALUES: TileShape[] = [
  'triangles',
  'squares',
  'hexagons',
  'octares',
  'hexgles',
  'squagles',
];

export const TERRITORY_COUNT_RANGES: Record<MapSize, [number, number]> = {
  small: [20, 40],
  medium: [40, 80],
  large: [80, 120],
  xlarge: [120, 160],
};

export const TERRITORY_MERGE_COUNTS: Record<MapSize, number> = {
  small: 3,
  medium: 6,
  large: 9,
  xlarge: 12,
};

export const TERRAIN_MAX_LAND_NEIGHBORS_PER_SEA: Record<MapSize, number> = {
  small: 9,
  medium: 11,
  large: 13,
  xlarge: 15,
};

export const FILL_THRESHOLDS: Record<Fill, number> = {
  full: 0.36,
  mixed: 0.48,
  sparse: 0.62,
};

export interface GridDimensions {
  width: number;
  height: number;
}

export const GRID_DIMENSIONS: Record<MapSize, GridDimensions> = {
  small: { width: 296, height: 166 },
  medium: { width: 418, height: 235 },
  large: { width: 512, height: 288 },
  xlarge: { width: 592, height: 333 },
};

export const OUTPUT_SCALE = 5;

export function mapImageSize(size: MapSize): GridDimensions {
  const grid = GRID_DIMENSIONS[size];
  return {
    width: grid.width * OUTPUT_SCALE,
    height: grid.height * OUTPUT_SCALE,
  };
}

export function expectedTerritoryArea(width: number, height: number): number {
  const area = width * height;
  const gap = (size: MapSize) => {
    const dims = mapImageSize(size);
    return Math.abs(dims.width * dims.height - area);
  };
  const size = MAP_SIZE_VALUES.reduce((best, s) =>
    gap(s) < gap(best) ? s : best,
  );
  const [min, max] = TERRITORY_COUNT_RANGES[size];
  return (2 * area) / (min + max);
}

export const CONTINENT_SIZE_MEAN = 7;
export const CONTINENT_SIZE_STD_DEV = 2.5;
export const CONTINENT_SIZE_MIN = 2;
export const CONTINENT_SIZE_MAX = 15;

export function mapSizeLabel(size: MapSize): string {
  return {
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    xlarge: 'Extra Large',
  }[size];
}

export function fillLabel(fill: Fill): string {
  return { full: 'Full', mixed: 'Mixed', sparse: 'Sparse' }[fill];
}

export function generationTypeLabel(type: GenerationType): string {
  return {
    terrain: 'Terrain',
    dungeon: 'Dungeon',
    temple: 'Temple',
    tile: 'Tile',
  }[type];
}

export function tileShapeLabel(tile: TileShape): string {
  return {
    triangles: 'Triangles',
    squares: 'Squares',
    hexagons: 'Hexagons',
    octares: 'Octares',
    hexgles: 'Hexgles',
    squagles: 'Squagles',
  }[tile];
}

export function generatedMapName(params: GenerateMapParams): string {
  const label =
    params.type === 'tile'
      ? tileShapeLabel(params.tile)
      : generationTypeLabel(params.type);
  return `${label} (${fillLabel(params.fill)}-${mapSizeLabel(params.size)})`;
}
