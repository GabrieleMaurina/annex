const CONTINENT_COLORS = [
  '#00FF1A',
  '#001AFF',
  '#FF0000',
  '#FFE500',
  '#CC00FF',
  '#00FFFF',
  '#FF9900',
  '#00B3FF',
  '#33FF00',
  '#FF0099',
  '#0066FF',
  '#FF4D00',
  '#8000FF',
  '#00FFB3',
  '#FF00E6',
  '#CCFF00',
  '#3300FF',
  '#00FF66',
  '#FF004D',
  '#80FF00',
];

export function continentColor(continentId: number): string {
  return CONTINENT_COLORS[continentId % CONTINENT_COLORS.length];
}
