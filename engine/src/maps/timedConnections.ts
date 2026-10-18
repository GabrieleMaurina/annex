import { TimedConnection } from '../types';

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
  const extra = new Map<number, number[]>();
  for (const c of connections) {
    if (!isConnectionOpen(c, round)) continue;
    extra.set(c.a, [...(extra.get(c.a) ?? []), c.b]);
    extra.set(c.b, [...(extra.get(c.b) ?? []), c.a]);
  }
  if (extra.size === 0) return nodes;
  return nodes.map((n) => {
    const added = extra.get(n.id);
    return added ? { ...n, neighbors: [...n.neighbors, ...added] } : n;
  });
}
