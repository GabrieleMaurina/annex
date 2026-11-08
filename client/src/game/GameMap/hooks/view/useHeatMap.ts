import { useMemo, useState } from 'react';
import type { GameState } from '../../../../lib/types';
import type { Territory } from '../../../mapData';
import type { ReplayData } from '../../../replay/replay';
import { attackCounts, heatMapColors } from '../../draw/heatMap';

export function useHeatMap(
  open: boolean,
  replayData: ReplayData | null | undefined,
  territories: Territory[],
  players: GameState['players'],
) {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const colorIndex = players.find((p) => p.id === playerId)?.color ?? null;
  const heatMap = useMemo(
    () =>
      open && replayData
        ? heatMapColors(
            attackCounts(replayData.frames, playerId),
            territories.map((t) => t.id),
            colorIndex,
          )
        : null,
    [open, replayData, playerId, territories, colorIndex],
  );
  return {
    heatMapPlayerId: playerId,
    setHeatMapPlayerId: setPlayerId,
    heatMap,
  };
}
