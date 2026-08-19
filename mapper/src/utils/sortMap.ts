import type { Territory } from '../types';

const ROW_TOLERANCE_FRACTION = 0.5;

function sortByPosition<T>(
  items: T[],
  getX: (item: T) => number,
  getY: (item: T) => number,
): T[] {
  if (items.length === 0) return [];
  const ys = items.map(getY);
  const range = Math.max(...ys) - Math.min(...ys);
  const averageSpacing = range / items.length;
  const tolerance = averageSpacing * ROW_TOLERANCE_FRACTION;

  const rows: T[][] = [];
  for (const item of [...items].sort((a, b) => getY(a) - getY(b))) {
    const row = rows[rows.length - 1];
    if (row && getY(item) - getY(row[0]) <= tolerance) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }
  return rows.flatMap((row) => [...row].sort((a, b) => getX(a) - getX(b)));
}

export function sortMapData(
  territories: Territory[],
  bonuses: number[],
): { territories: Territory[]; bonuses: number[] } {
  const continents = bonuses.map((_, id) => {
    const members = territories.filter((t) => t.continentId === id);
    const center = members.length
      ? {
          x: members.reduce((sum, t) => sum + t.x, 0) / members.length,
          y: members.reduce((sum, t) => sum + t.y, 0) / members.length,
        }
      : null;
    return { id, center };
  });
  const positioned = continents.filter((c) => c.center !== null);
  const empty = continents.filter((c) => c.center === null);
  const sortedContinents = sortByPosition(
    positioned,
    (c) => c.center!.x,
    (c) => c.center!.y,
  ).concat(empty);

  const continentIdMap = new Map(
    sortedContinents.map((c, newId) => [c.id, newId]),
  );
  const newBonuses = sortedContinents.map((c) => bonuses[c.id]);
  const remapped = territories.map((t) => ({
    ...t,
    continentId: continentIdMap.get(t.continentId)!,
  }));

  const sortedTerritories = sortedContinents.flatMap((_, newContinentId) =>
    sortByPosition(
      remapped.filter((t) => t.continentId === newContinentId),
      (t) => t.x,
      (t) => t.y,
    ),
  );

  const territoryIdMap = new Map(
    sortedTerritories.map((t, newId) => [t.id, newId]),
  );
  const newTerritories = sortedTerritories.map((t, newId) => ({
    ...t,
    id: newId,
    neighbors: t.neighbors.map((n) => territoryIdMap.get(n)!),
  }));

  return { territories: newTerritories, bonuses: newBonuses };
}
