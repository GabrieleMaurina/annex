export const CARD_LEVEL_MAX = 6;
export const LINE_LEVEL_MAX = 12;

export type PlayersLevel = 'cards' | 'lines' | 'chips';

export function levelFor(count: number): PlayersLevel {
  if (count <= CARD_LEVEL_MAX) return 'cards';
  if (count <= LINE_LEVEL_MAX) return 'lines';
  return 'chips';
}
