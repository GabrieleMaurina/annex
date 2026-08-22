const CONTINENT_COLORS = [
  '#E53935',
  '#1E88E5',
  '#43A047',
  '#FDD835',
  '#8E44AD',
  '#FB8C00',
  '#E91E63',
  '#00D4E8',
  '#795548',
  '#7CB342',
  '#3949AB',
  '#FFB300',
  '#AD1457',
  '#1B6E3C',
  '#1976A8',
  '#B71C1C',
  '#827717',
  '#6A1B9A',
  '#A44A2A',
  '#00897B',
];

export function continentColor(continentId: number): string {
  return CONTINENT_COLORS[continentId % CONTINENT_COLORS.length];
}

export const PLAYER_COLORS = CONTINENT_COLORS;

export function playerColor(colorIndex: number): string {
  return PLAYER_COLORS[colorIndex];
}

export function contrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
