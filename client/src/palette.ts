const CONTINENT_COLORS = [
  "#E53935", // Red
  "#1E88E5", // Blue
  "#43A047", // Green
  "#FDD835", // Yellow
  "#8E44AD", // Purple
  "#FB8C00", // Orange
  "#E91E63", // Pink
  "#00D4E8", // Cyan
  "#795548", // Brown
  "#7CB342", // Lime
  "#3949AB", // Indigo
  "#FFB300", // Amber
  "#AD1457", // Magenta
  "#1B6E3C", // Forest
  "#1976A8", // Azure
  "#B71C1C", // Crimson
  "#827717", // Olive
  "#6A1B9A", // Plum
  "#A44A2A", // Rust
  "#00897B", // Turquoise
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
