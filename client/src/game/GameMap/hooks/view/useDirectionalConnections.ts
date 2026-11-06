import {
  linkKey,
  pointsForward,
  roundsUntilFlip,
  withDirectedConnections,
} from 'engine';
import { useMemo } from 'react';
import type {
  DirectionalConnection,
  SwitchedLink,
} from '../../../../lib/types';
import type { Territory } from '../../../mapData';

export interface DirectionalLink {
  a: number;
  b: number;
  forward: boolean;
  roundsLeft: number | null;
  control: SwitchedLink | null;
}

export function useDirectionalConnections(
  territories: Territory[],
  directionalConnections: DirectionalConnection[],
  round: number,
  switched: ReadonlyMap<string, boolean>,
  controls: ReadonlyMap<string, SwitchedLink>,
) {
  return useMemo(
    () => ({
      territories: withDirectedConnections(
        territories,
        directionalConnections,
        round,
        switched,
      ),
      directionalLinks: directionalConnections.map((c): DirectionalLink => {
        const key = linkKey(c.a, c.b);
        const on = switched.get(key);
        return {
          a: c.a,
          b: c.b,
          forward: on ?? pointsForward(c, round),
          roundsLeft: on === undefined ? roundsUntilFlip(c, round) : null,
          control: controls.get(key) ?? null,
        };
      }),
    }),
    [territories, directionalConnections, round, switched, controls],
  );
}
