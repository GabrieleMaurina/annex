const EARTH_TONES = [
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
