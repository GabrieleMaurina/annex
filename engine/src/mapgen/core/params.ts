export type MapSize = 'small' | 'medium' | 'large' | 'xlarge';
export type WaterLevel = 'land' | 'mixed' | 'ocean';

export interface GenerateMapParams {
  seed: string;
  size: MapSize;
  water: WaterLevel;
}

export const MAP_SIZE_VALUES: MapSize[] = [
  'small',
  'medium',
  'large',
  'xlarge',
];
export const WATER_LEVEL_VALUES: WaterLevel[] = ['land', 'mixed', 'ocean'];

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

export const WATER_THRESHOLDS: Record<WaterLevel, number> = {
  land: 0.36,
  mixed: 0.48,
  ocean: 0.62,
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

export function waterLevelLabel(water: WaterLevel): string {
  return { land: 'Land', mixed: 'Mixed', ocean: 'Ocean' }[water];
}

export function generatedMapName(params: GenerateMapParams): string {
  return `Generated: ${params.seed} · ${mapSizeLabel(params.size)} · ${waterLevelLabel(params.water)}`;
}

export function generatedMapDisplayName(params: GenerateMapParams): string {
  return `${waterLevelLabel(params.water)} (${mapSizeLabel(params.size)})`;
}
