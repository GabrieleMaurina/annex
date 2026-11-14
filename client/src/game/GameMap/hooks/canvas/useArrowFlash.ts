import { useCallback } from 'react';
import type { GameState } from '../../../../lib/types';
import {
  areAnimationsDisabled,
  startAnimation,
  type ArrowPoint,
} from '../../../animations';

export function useArrowFlash({
  visibleTerritoryIds,
  idRunsForPath,
  territoryPoints,
}: {
  visibleTerritoryIds: GameState['visibleTerritoryIds'];
  idRunsForPath: (pathRun: number[]) => number[][];
  territoryPoints: (ids: number[], shipOwnerId?: number) => ArrowPoint[];
}) {
  const arrowForPath = useCallback(
    (
      pathRuns: number[][],
      shipOwnerId?: number,
    ): {
      runs?: ArrowPoint[][];
      fades?: ('start' | 'end' | undefined)[][];
    } => {
      const visible = visibleTerritoryIds ? new Set(visibleTerritoryIds) : null;
      const runs: ArrowPoint[][] = [];
      const fades: ('start' | 'end' | undefined)[][] = [];
      for (const pathRun of pathRuns) {
        for (const idRun of idRunsForPath(pathRun)) {
          let currentIds: number[] = [idRun[0]];
          let currentFades: ('start' | 'end' | undefined)[] = [];
          const flush = () => {
            if (currentIds.length > 1) {
              runs.push(territoryPoints(currentIds, shipOwnerId));
              fades.push(currentFades);
            }
          };
          for (let i = 1; i < idRun.length; i++) {
            const fromId = idRun[i - 1];
            const toId = idRun[i];
            const fromVisible = !visible || visible.has(fromId);
            const toVisible = !visible || visible.has(toId);
            if (!fromVisible && !toVisible) {
              flush();
              currentIds = [toId];
              currentFades = [];
              continue;
            }
            currentIds.push(toId);
            currentFades.push(
              fromVisible && toVisible
                ? undefined
                : fromVisible
                  ? 'end'
                  : 'start',
            );
          }
          flush();
        }
      }
      if (runs.length === 0) return {};
      return { runs, fades };
    },
    [idRunsForPath, territoryPoints, visibleTerritoryIds],
  );

  return useCallback(
    (pathRuns: number[][], shipOwnerId?: number) => {
      if (areAnimationsDisabled()) return;
      const arrow = arrowForPath(pathRuns, shipOwnerId);
      if (!arrow.runs || arrow.runs.length === 0) return;
      const lastRun = arrow.runs[arrow.runs.length - 1];
      const anchor = lastRun[lastRun.length - 1];
      startAnimation(
        'arrow',
        anchor.x,
        anchor.y,
        undefined,
        undefined,
        arrow.runs,
        arrow.fades,
      );
    },
    [arrowForPath],
  );
}
