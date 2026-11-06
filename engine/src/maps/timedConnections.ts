import { TimedConnection } from '../types';
import { withArcs } from './directionalConnections';
import { linkKey } from './switches';

export const MAX_TIMED_VALUE = 10;

export function isConnectionOpen(
  connection: TimedConnection,
  round: number,
): boolean {
  const { delay, open, closed } = connection;
  return round >= delay && (round - delay) % (open + closed) < open;
}

export function roundsUntilToggle(
  connection: TimedConnection,
  round: number,
): number {
  const { delay, open, closed } = connection;
  if (round < delay) return delay - round;
  const phase = (round - delay) % (open + closed);
  return phase < open ? open - phase : open + closed - phase;
}

export function withOpenConnections<
  T extends { id: number; neighbors: number[] },
>(
  nodes: T[],
  connections: TimedConnection[],
  round: number,
  switched: ReadonlyMap<string, boolean>,
): T[] {
  return withArcs(
    nodes,
    connections
      .filter(
        (c) => switched.get(linkKey(c.a, c.b)) ?? isConnectionOpen(c, round),
      )
      .flatMap(({ a, b }): [number, number][] => [
        [a, b],
        [b, a],
      ]),
  );
}
