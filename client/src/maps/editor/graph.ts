import type { EditorTerritory as Territory } from './model/editorTypes';
import type { EditorLockedTile } from './model/lockedTiles';

export function isConnected(
  territories: Territory[],
  lockedTiles: EditorLockedTile[],
): boolean {
  if (territories.length === 0) return true;
  const byId = new Map(territories.map((t) => [t.id, t]));
  const tileLinks = new Map<number, number[]>();
  const link = (a: number, b: number) =>
    tileLinks.set(a, [...(tileLinks.get(a) ?? []), b]);
  lockedTiles.forEach((tile, k) => {
    for (const n of tile.land) {
      if (!byId.has(n) || byId.get(n)!.isSea) continue;
      link(-1 - k, n);
      link(n, -1 - k);
    }
    for (const other of tile.tiles) link(-1 - k, -1 - other);
  });
  const visited = new Set<number>();
  const stack = [territories[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const t = byId.get(id);
    for (const n of [
      ...(t?.neighbors ?? []),
      ...(t?.timed.map((m) => m.id) ?? []),
      ...(tileLinks.get(id) ?? []),
    ]) {
      if (!visited.has(n)) stack.push(n);
    }
  }
  return territories.every((t) => visited.has(t.id));
}
