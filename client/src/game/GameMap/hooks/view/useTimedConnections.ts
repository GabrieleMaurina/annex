import {
  isConnectionOpen,
  linkKey,
  roundsUntilToggle,
  withOpenConnections,
} from 'engine';
import { useMemo } from 'react';
import type { SwitchedLink, TimedConnection } from '../../../../lib/types';
import type { Territory } from '../../../mapData';

export interface TimedLink {
  a: number;
  b: number;
  open: boolean;
  roundsLeft: number | null;
  control: SwitchedLink | null;
}

export function useTimedConnections(
  territories: Territory[],
  timedConnections: TimedConnection[],
  round: number,
  switched: ReadonlyMap<string, boolean>,
  controls: ReadonlyMap<string, SwitchedLink>,
) {
  return useMemo(
    () => ({
      territories: withOpenConnections(
        territories,
        timedConnections,
        round,
        switched,
      ),
      timedLinks: timedConnections.map((c): TimedLink => {
        const key = linkKey(c.a, c.b);
        const on = switched.get(key);
        return {
          a: c.a,
          b: c.b,
          open: on ?? isConnectionOpen(c, round),
          roundsLeft: on === undefined ? roundsUntilToggle(c, round) : null,
          control: controls.get(key) ?? null,
        };
      }),
    }),
    [territories, timedConnections, round, switched, controls],
  );
}
