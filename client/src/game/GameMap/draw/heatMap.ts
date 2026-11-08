import { PLAYER_COLORS, playerColor } from '../../../lib/palette';
import type { ReplayFrame } from '../../replay/replayTypes';

const WHITE = '#ffffff';
const BLACK = '#000000';
const WHITE_PLAYER_COLOR = PLAYER_COLORS[7];

export function attackCounts(frames: ReplayFrame[], playerId: number | null) {
  const counts = new Map<number, number>();
  const add = (territoryId: number) =>
    counts.set(territoryId, (counts.get(territoryId) ?? 0) + 1);
  for (const { animation } of frames) {
    if (animation.type !== 'attack') continue;
    if (playerId === null || animation.attackerId === playerId)
      add(animation.attackingTerritoryId);
    if (playerId === null || animation.defenderId === playerId)
      add(animation.defendingTerritoryId);
  }
  return counts;
}

function channels(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function mix(from: string, to: string, amount: number) {
  const end = channels(to);
  return `#${channels(from)
    .map((c, i) =>
      Math.round(c + (end[i] - c) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function heatMapColors(
  counts: Map<number, number>,
  territoryIds: number[],
  colorIndex: number | null,
) {
  const playerHex = colorIndex === null ? null : playerColor(colorIndex);
  const [from, to] = !playerHex
    ? [WHITE, BLACK]
    : playerHex === WHITE_PLAYER_COLOR
      ? [BLACK, playerHex]
      : [WHITE, playerHex];
  const values = territoryIds.map((id) => counts.get(id) ?? 0);
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  return new Map(
    territoryIds.map((id, i) => [
      id,
      mix(from, to, range === 0 ? 0 : (values[i] - min) / range),
    ]),
  );
}
