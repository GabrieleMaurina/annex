import { TimedConnection } from '../types';
import { withArcs } from './directionalConnections';

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
>(nodes: T[], connections: TimedConnection[], round: number): T[] {
  return withArcs(
    nodes,
    connections
      .filter((c) => isConnectionOpen(c, round))
      .flatMap(({ a, b }): [number, number][] => [
        [a, b],
        [b, a],
      ]),
  );
}
