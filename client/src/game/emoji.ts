import type { EmojiValue } from '../lib/types';

export const EMOJIS: EmojiValue[] = ['👍', '👎', '❤️', '🙂', '🙁', '⚔️'];
export const ATTACK_EMOJI: EmojiValue = '⚔️';
export const EMOJI_POP_DURATION = 2200;
export const EMOJI_FLIGHT_SPEED = 1;
export const EMOJI_FLIGHT_MIN_TRAVEL_DURATION = 200;
export const EMOJI_FLIGHT_LINGER = 1000;
export const EMOJI_PANEL_EDGE_OFFSET = 17;
export const EMOJI_TERRITORY_SIDE_GAP = 14;

export interface EmojiPop {
  id: number;
  rowPlayerId: number;
  emoji: EmojiValue;
  attackText?: string;
  attackColor?: string;
}

export function emojiFlightDurations(distance: number) {
  const travelDuration = Math.max(
    EMOJI_FLIGHT_MIN_TRAVEL_DURATION,
    distance / EMOJI_FLIGHT_SPEED,
  );
  const totalDuration = travelDuration + EMOJI_FLIGHT_LINGER;
  const travelPercent = (travelDuration / totalDuration) * 100;
  return { totalDuration, travelPercent };
}
