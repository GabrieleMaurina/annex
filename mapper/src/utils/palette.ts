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
