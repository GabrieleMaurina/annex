import { TimedConnection } from '../types';
import { randomInt, Rng } from './core/rng';
import { SpecialEdge } from './pipeline/connectivity';

export function extractTimedConnections(
  rng: Rng | null,
  edges: SpecialEdge[],
  adjacency: Map<number, Set<number>>,
): TimedConnection[] {
  if (!rng || edges.length === 0) return [];
  const pool = [...edges];
  const count = randomInt(rng, 1, Math.ceil(edges.length / 2));
  const timedConnections: TimedConnection[] = [];
  for (let i = 0; i < count; i++) {
    const [{ a, b }] = pool.splice(randomInt(rng, 0, pool.length - 1), 1);
    adjacency.get(a)!.delete(b);
    adjacency.get(b)!.delete(a);
    timedConnections.push({
      a,
      b,
      delay: randomInt(rng, 0, 1),
      open: 1,
      closed: 1,
    });
  }
  return timedConnections;
}
