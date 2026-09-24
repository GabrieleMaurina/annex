import type { MapSeaTerritory, MapTerritory, MapWrap } from '../../lib/types';
import {
  NO_CONTINENT,
  type EditorTerritory as Territory,
} from './model/editorTypes';

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

export interface SortedTerritories {
  territories: Territory[];
  bonuses: number[];
}

export function sortTerritories(
  territories: Territory[],
  bonuses: number[],
): SortedTerritories {
  const land = territories.filter((t) => !t.isSea);
  const sea = territories.filter((t) => t.isSea);

  const continents = bonuses.map((_, id) => {
    const members = land.filter((t) => t.continentId === id);
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
  const remapped = land.map((t) => ({
    ...t,
    continentId: continentIdMap.get(t.continentId) ?? NO_CONTINENT,
  }));

  const sortedLand = [
    ...sortedContinents.flatMap((_, newContinentId) =>
      sortByPosition(
        remapped.filter((t) => t.continentId === newContinentId),
        (t) => t.x,
        (t) => t.y,
      ),
    ),
    ...sortByPosition(
      remapped.filter((t) => t.continentId === NO_CONTINENT),
      (t) => t.x,
      (t) => t.y,
    ),
  ];
  const sortedSea = sortByPosition(
    sea,
    (t) => t.x,
    (t) => t.y,
  );

  const idMap = new Map<number, number>();
  sortedLand.forEach((t, i) => idMap.set(t.id, i));
  sortedSea.forEach((t, i) => idMap.set(t.id, sortedLand.length + i));

  const newTerritories: Territory[] = [...sortedLand, ...sortedSea].map(
    (t) => ({
      ...t,
      id: idMap.get(t.id)!,
      neighbors: t.neighbors.map((n) => idMap.get(n)!),
      wraps: t.wraps.map((w) => ({ ...w, id: idMap.get(w.id)! })),
    }),
  );

  return {
    territories: newTerritories,
    bonuses: newBonuses,
  };
}

export function sortMapData(
  territories: Territory[],
  bonuses: number[],
): {
  territories: MapTerritory[];
  seaTerritories: MapSeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
} {
  const sorted = sortTerritories(territories, bonuses);
  const newTerritories: MapTerritory[] = sorted.territories
    .filter((t) => !t.isSea)
    .map((t) => ({
      id: t.id,
      continentId: t.continentId,
      x: t.x,
      y: t.y,
      neighbors: t.neighbors,
    }));
  const newSeaTerritories: MapSeaTerritory[] = sorted.territories
    .filter((t) => t.isSea)
    .map((t) => ({ id: t.id, x: t.x, y: t.y, neighbors: t.neighbors }));

  return {
    territories: newTerritories,
    seaTerritories: newSeaTerritories,
    bonuses: sorted.bonuses,
    wraps: sorted.territories.flatMap((t) =>
      t.wraps
        .filter((w) => t.id < w.id)
        .map((w) => ({ a: t.id, b: w.id, x: w.x, y: w.y })),
    ),
  };
}
