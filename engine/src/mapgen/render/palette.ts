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

export const WATER_COLOR = '#3d6b8a';
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
