import {
  isConnectionOpen,
  roundsUntilToggle,
  withOpenConnections,
} from 'engine';
import { useMemo } from 'react';
import type { TimedConnection } from '../../../../lib/types';
import type { Territory } from '../../../mapData';

export interface TimedLink {
  a: number;
  b: number;
  open: boolean;
  roundsLeft: number;
}

export function useTimedConnections(
  territories: Territory[],
  timedConnections: TimedConnection[],
  round: number,
) {
  return useMemo(
    () => ({
      territories: withOpenConnections(territories, timedConnections, round),
      timedLinks: timedConnections.map((c): TimedLink => ({
        a: c.a,
        b: c.b,
        open: isConnectionOpen(c, round),
        roundsLeft: roundsUntilToggle(c, round),
      })),
    }),
    [territories, timedConnections, round],
  );
}
