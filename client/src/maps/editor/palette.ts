import { PLAYER_COLORS } from '../../lib/palette';

const NO_CONTINENT_COLOR = '#9E9E9E';

export function continentColor(continentId: number): string {
  if (continentId < 0) return NO_CONTINENT_COLOR;
  return PLAYER_COLORS[continentId % PLAYER_COLORS.length];
}

export const SEA_MARKER_COLOR = '#0d6efd';
