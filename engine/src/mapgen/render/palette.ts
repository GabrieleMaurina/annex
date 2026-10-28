import { GenerationType } from '../core/params';

export const EARTH_TONES = [
  '#7a8450',
  '#a6813f',
  '#5f7a52',
  '#8c6b46',
  '#6b8e5a',
  '#b08d57',
  '#4f6b4a',
  '#9c7a4a',
  '#7d9463',
  '#8a5a3c',
  '#647d3f',
  '#a68a5c',
  '#556b4f',
  '#96703f',
  '#749169',
];

export function continentEarthTone(continentId: number): string {
  return EARTH_TONES[continentId % EARTH_TONES.length];
}

export const SEA_COLOR = '#3d6b8a';
export const VOID_LAND_COLOR = '#45453f';
export const MOUNTAIN_COLOR = '#cfc8bb';
export const RIVER_BORDER_COLOR = '#4a90d9';
export const TERRITORY_STROKE_COLOR = '#000000';

export const DUNGEON_TONES = [
  '#6b6e73',
  '#7d7f83',
  '#585a5e',
  '#8a8d91',
  '#4e5155',
  '#75787c',
  '#616469',
  '#828589',
  '#535659',
  '#6f7378',
  '#7a7d81',
  '#5c5f63',
];

export function continentDungeonTone(continentId: number): string {
  return DUNGEON_TONES[continentId % DUNGEON_TONES.length];
}

export const DUNGEON_VOID_COLOR = '#161719';
export const DUNGEON_WALL_COLOR = '#2b2d30';
export const DUNGEON_SEAM_COLOR = '#3c3f43';

export const TEMPLE_TONES = [
  '#3b4a7a',
  '#5a4b8c',
  '#4468a8',
  '#6a4f9e',
  '#2f5f8f',
  '#7a56ac',
  '#40548f',
  '#5b5aa0',
  '#33739e',
  '#6d4f9a',
  '#48619c',
  '#8163b4',
];

export function continentTempleTone(continentId: number): string {
  return TEMPLE_TONES[continentId % TEMPLE_TONES.length];
}

export const TEMPLE_VOID_COLOR = '#0b0f22';
export const TEMPLE_WALL_COLOR = '#1b2444';
export const TEMPLE_SEAM_COLOR = '#7fd8ff';

export const TILE_TONES = [
  '#0d2466',
  '#06402f',
  '#141b56',
  '#073d63',
  '#102a7a',
  '#0a4a3a',
  '#0b3570',
  '#1a1f70',
  '#05405a',
  '#0b3a24',
  '#0f3388',
  '#083a4e',
];

export function continentTileTone(continentId: number): string {
  return TILE_TONES[continentId % TILE_TONES.length];
}

export const TILE_VOID_COLOR = '#000000';
export const TILE_SEA_COLOR = '#000011';
export const TILE_WALL_COLOR = '#39ff7a';
export const TILE_SEAM_COLOR = '#1e9bff';

export const DEFAULT_BORDER_COLORS = [TERRITORY_STROKE_COLOR];

export function generatedBorderColors(type: GenerationType): string[] {
  if (type === 'dungeon')
    return [DUNGEON_VOID_COLOR, DUNGEON_WALL_COLOR, DUNGEON_SEAM_COLOR];
  if (type === 'temple')
    return [TEMPLE_VOID_COLOR, TEMPLE_WALL_COLOR, TEMPLE_SEAM_COLOR];
  if (type === 'tile')
    return [TILE_VOID_COLOR, TILE_WALL_COLOR, TILE_SEAM_COLOR];
  return [TERRITORY_STROKE_COLOR];
}
