export function validateTerritoryGraph(
  territoryCount: number,
  adjacency: Map<number, Set<number>>,
): void {
  if (territoryCount === 0) return;

  for (const [id, neighbors] of adjacency) {
    if (neighbors.has(id)) throw new Error(`territory ${id} neighbors itself`);
    for (const neighbor of neighbors) {
      if (!adjacency.get(neighbor)?.has(id)) {
        throw new Error(`asymmetric adjacency between ${id} and ${neighbor}`);
      }
    }
  }

  const visited = new Set<number>();
  const stack = [0];
  visited.add(0);
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const neighbor of adjacency.get(id) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }
  }
  if (visited.size !== territoryCount) {
    throw new Error(
      `territory graph is not fully connected: reached ${visited.size} of ${territoryCount}`,
    );
  }
}
