import {
  pointsForward,
  roundsUntilFlip,
  withDirectedConnections,
} from 'engine';
import { useMemo } from 'react';
import type { DirectionalConnection } from '../../../../lib/types';
import type { Territory } from '../../../mapData';

export interface DirectionalLink {
  a: number;
  b: number;
  forward: boolean;
  roundsLeft: number | null;
}

export function useDirectionalConnections(
  territories: Territory[],
  directionalConnections: DirectionalConnection[],
  round: number,
) {
  return useMemo(
    () => ({
      territories: withDirectedConnections(
        territories,
        directionalConnections,
        round,
      ),
      directionalLinks: directionalConnections.map((c): DirectionalLink => ({
        a: c.a,
        b: c.b,
        forward: pointsForward(c, round),
        roundsLeft: roundsUntilFlip(c, round),
      })),
    }),
    [territories, directionalConnections, round],
  );
}
