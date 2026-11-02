import { DirectionalConnection, TimedConnection } from '../types';

export function pointsForward(
  connection: DirectionalConnection,
  round: number,
): boolean {
  const { forward, backward } = connection;
  return round % (forward + backward) < forward;
}

export function roundsUntilFlip(
  connection: DirectionalConnection,
  round: number,
): number | null {
  const { forward, backward } = connection;
  if (backward === 0) return null;
  const phase = round % (forward + backward);
  return phase < forward ? forward - phase : forward + backward - phase;
}

export function withArcs<T extends { id: number; neighbors: number[] }>(
  nodes: T[],
  arcs: [number, number][],
): T[] {
  const extra = new Map<number, number[]>();
  for (const [from, to] of arcs)
    extra.set(from, [...(extra.get(from) ?? []), to]);
  if (extra.size === 0) return nodes;
  return nodes.map((n) => {
    const added = extra.get(n.id);
    return added ? { ...n, neighbors: [...n.neighbors, ...added] } : n;
  });
}

export function withDirectedConnections<
  T extends { id: number; neighbors: number[] },
>(nodes: T[], connections: DirectionalConnection[], round: number): T[] {
  return withArcs(
    nodes,
    connections.map((c): [number, number] =>
      pointsForward(c, round) ? [c.a, c.b] : [c.b, c.a],
    ),
  );
}

export function withEventualLinks<
  T extends { id: number; neighbors: number[] },
>(
  nodes: T[],
  timedConnections: TimedConnection[],
  directionalConnections: DirectionalConnection[],
): T[] {
  return withArcs(nodes, [
    ...timedConnections.flatMap(({ a, b }): [number, number][] => [
      [a, b],
      [b, a],
    ]),
    ...directionalConnections.flatMap(
      ({ a, b, backward }): [number, number][] =>
        backward > 0
          ? [
              [a, b],
              [b, a],
            ]
          : [[a, b]],
    ),
  ]);
}

export function withSeaHops(
  nodes: { id: number; neighbors: number[] }[],
  seaIds: Set<number>,
): { id: number; neighbors: number[] }[] {
  const shoresBySea = new Map(
    nodes
      .filter((n) => seaIds.has(n.id))
      .map((n) => [n.id, n.neighbors.filter((id) => !seaIds.has(id))]),
  );
  return nodes
    .filter((n) => !seaIds.has(n.id))
    .map((n) => ({
      id: n.id,
      neighbors: n.neighbors.flatMap((id) => shoresBySea.get(id) ?? [id]),
    }));
}

function reached(start: number, edges: Map<number, number[]>): Set<number> {
  const visited = new Set<number>([start]);
  const stack = [start];
  while (stack.length > 0) {
    for (const n of edges.get(stack.pop()!) ?? []) {
      if (visited.has(n)) continue;
      visited.add(n);
      stack.push(n);
    }
  }
  return visited;
}

export function isStronglyConnected(
  ids: number[],
  edges: Map<number, number[]>,
): boolean {
  if (ids.length === 0) return true;
  const reverse = new Map<number, number[]>();
  for (const [from, tos] of edges)
    for (const to of tos) reverse.set(to, [...(reverse.get(to) ?? []), from]);
  const forward = reached(ids[0], edges);
  const backward = reached(ids[0], reverse);
  return ids.every((id) => forward.has(id) && backward.has(id));
}
