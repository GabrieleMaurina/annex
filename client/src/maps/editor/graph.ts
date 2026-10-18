import type { EditorTerritory as Territory } from './model/editorTypes';

export function isConnected(territories: Territory[]): boolean {
  if (territories.length === 0) return true;
  const byId = new Map(territories.map((t) => [t.id, t]));
  const visited = new Set<number>();
  const stack = [territories[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const t = byId.get(id)!;
    for (const n of [...t.neighbors, ...t.timed.map((m) => m.id)]) {
      if (!visited.has(n)) stack.push(n);
    }
  }
  return visited.size === territories.length;
}
