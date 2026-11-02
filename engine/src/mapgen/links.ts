import {
  isStronglyConnected,
  withEventualLinks,
  withSeaHops,
} from '../maps/directionalConnections';
import { DirectionalConnection, TimedConnection } from '../types';
import { createRng, randomInt, Rng } from './core/rng';
import { SpecialEdge } from './pipeline/connectivity';
import { extractTimedConnections } from './timed';

export interface LinkRngs {
  timed: Rng | null;
  directional: Rng | null;
}

interface ScheduledLinks {
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
}

export function createLinkRngs(
  key: string,
  timed: boolean,
  directional: boolean,
): LinkRngs {
  return {
    timed: timed ? createRng(`${key}::timed`) : null,
    directional: directional ? createRng(`${key}::directional`) : null,
  };
}

function staysStronglyConnected(
  adjacency: Map<number, Set<number>>,
  landCount: number,
  timedConnections: TimedConnection[],
  directionalConnections: DirectionalConnection[],
): boolean {
  const nodes = withEventualLinks(
    withSeaHops(
      [...adjacency].map(([id, ids]) => ({ id, neighbors: [...ids] })),
      new Set([...adjacency.keys()].filter((id) => id >= landCount)),
    ),
    timedConnections,
    directionalConnections,
  );
  return isStronglyConnected(
    nodes.map((n) => n.id),
    new Map(nodes.map((n) => [n.id, n.neighbors])),
  );
}

function extractDirectionalConnections(
  rng: Rng | null,
  edges: SpecialEdge[],
  adjacency: Map<number, Set<number>>,
  landCount: number,
  timedConnections: TimedConnection[],
): DirectionalConnection[] {
  if (!rng || edges.length === 0) return [];
  const pool = [...edges];
  const count = randomInt(rng, 1, Math.ceil(edges.length / 2));
  const directionalConnections: DirectionalConnection[] = [];
  for (let i = 0; i < count; i++) {
    const [edge] = pool.splice(randomInt(rng, 0, pool.length - 1), 1);
    const [a, b] =
      randomInt(rng, 0, 1) === 0 ? [edge.a, edge.b] : [edge.b, edge.a];
    adjacency.get(a)!.delete(b);
    adjacency.get(b)!.delete(a);
    const connection = {
      a,
      b,
      forward: randomInt(rng, 1, 2),
      backward: randomInt(rng, 0, 2),
    };
    if (
      connection.backward === 0 &&
      !staysStronglyConnected(adjacency, landCount, timedConnections, [
        ...directionalConnections,
        connection,
      ])
    )
      connection.backward = 1;
    directionalConnections.push(connection);
  }
  return directionalConnections;
}

export function extractScheduledLinks(
  rngs: LinkRngs,
  edges: SpecialEdge[],
  adjacency: Map<number, Set<number>>,
  landCount: number,
): ScheduledLinks {
  const timedConnections = extractTimedConnections(
    rngs.timed,
    edges,
    adjacency,
  );
  const remaining = edges.filter(({ a, b }) => adjacency.get(a)?.has(b));
  return {
    timedConnections,
    directionalConnections: extractDirectionalConnections(
      rngs.directional,
      remaining,
      adjacency,
      landCount,
      timedConnections,
    ),
  };
}
