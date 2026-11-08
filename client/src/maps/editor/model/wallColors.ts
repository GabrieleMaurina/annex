import type { GenerateMapInput } from '../../../lib/types';

const VOID_FIRST_TYPES = ['tile', 'dungeon', 'temple'];
const VOID_FIRST_COLORS = 3;

export function wallColorsOf(
  generation: GenerateMapInput | null,
  borderColors: string[],
): string[] {
  return generation &&
    VOID_FIRST_TYPES.includes(generation.type) &&
    borderColors.length >= VOID_FIRST_COLORS
    ? borderColors.slice(1)
    : borderColors;
}
