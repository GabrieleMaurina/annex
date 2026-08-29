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

export const WATER_THRESHOLDS: Record<WaterLevel, number> = {
  land: 0.36,
  mixed: 0.48,
  ocean: 0.62,
};

export interface GridDimensions {
  width: number;
  height: number;
}

// All four keep the mapper's 16:9 aspect ratio; 'large' matches the mapper's
// own default resolution (2560x1440 at OUTPUT_SCALE 5) exactly, and the
// others scale area by thirds relative to it (small = 1x, medium = 2x,
// large = 3x, xlarge = 4x) so average territory area stays consistent across
// sizes, since territory count scales with area too.
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

// Internal registry key only (see server/src/maps.ts): must stay unique per
// seed/size/water so two unrelated games' generated maps never collide in
// the shared map registry. Never shown to users - see generatedMapDisplayName.
export function generatedMapName(params: GenerateMapParams): string {
  return `Generated: ${params.seed} · ${mapSizeLabel(params.size)} · ${waterLevelLabel(params.water)}`;
}

// The human-facing name, shown in the lobby UI - deliberately not unique
// (e.g. "Ocean (Large)"), same convention as a bot's "Killer (Hard)" name.
export function generatedMapDisplayName(params: GenerateMapParams): string {
  return `${waterLevelLabel(params.water)} (${mapSizeLabel(params.size)})`;
}
