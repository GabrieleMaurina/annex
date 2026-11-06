import { linkKey } from 'engine';
import type {
  DirectionalConnection,
  FixedTile,
  LockedTile,
  MapSeaTerritory,
  MapSwitch,
  MapTerritory,
  MapWrap,
  SwitchedLink,
  TimedConnection,
} from '../../lib/types';
import {
  NO_CONTINENT,
  type EditorTerritory as Territory,
} from './model/editorTypes';
import { toLockedTiles } from './model/lockedTiles';
import {
  lockedLinks,
  roundedPoints,
  type EditorTile,
} from './tiles/editorTiles';

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
  continentNames: string[];
  idMap: Map<number, number>;
}

export function sortTerritories(
  territories: Territory[],
  bonuses: number[],
  continentNames: string[],
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
  const newContinentNames = sortedContinents.map((c) => continentNames[c.id]);
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
      timed: t.timed.map((m) => ({ ...m, id: idMap.get(m.id)! })),
      directional: t.directional.map((m) => ({ ...m, id: idMap.get(m.id)! })),
      switch: t.switch && {
        ...t.switch,
        wires: t.switch.wires.map((w) => ({
          a: idMap.get(w.a)!,
          b: idMap.get(w.b)!,
        })),
      },
    }),
  );

  return {
    territories: newTerritories,
    bonuses: newBonuses,
    continentNames: newContinentNames,
    idMap,
  };
}

export function sortMapData(
  territories: Territory[],
  bonuses: number[],
  continentNames: string[],
  tiles: EditorTile[],
): {
  territories: MapTerritory[];
  seaTerritories: MapSeaTerritory[];
  bonuses: number[];
  wraps: MapWrap[];
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
  switches: MapSwitch[];
  switchedLinks: SwitchedLink[];
  lockedTiles: LockedTile[];
  fixedTiles: FixedTile[];
  territoryNames: string[];
  seaNames: string[];
  continentNames: string[];
} {
  const skippedIds = new Set(
    territories.filter((t) => t.locked || t.switch).map((t) => t.id),
  );
  const sorted = sortTerritories(
    territories
      .filter((t) => !skippedIds.has(t.id))
      .map((t) => ({
        ...t,
        neighbors: t.neighbors.filter((n) => !skippedIds.has(n)),
      })),
    bonuses,
    continentNames,
  );
  const newId = (id: number) => sorted.idMap.get(id)!;
  const switchVertices = sortByPosition(
    territories.filter((t) => t.switch),
    (t) => t.x,
    (t) => t.y,
  );
  const gateOf = (a: number, b: number) => {
    const t = sorted.territories.find((s) => s.id === a)!;
    return [...t.timed, ...t.directional].find((m) => m.id === b)!.gate;
  };
  const switchedLinks = new Map<string, SwitchedLink>();
  switchVertices.forEach((t, i) => {
    for (const wire of t.switch!.wires) {
      const a = newId(wire.a);
      const b = newId(wire.b);
      const entry = switchedLinks.get(linkKey(a, b)) ?? {
        a,
        b,
        switches: [],
        gate: gateOf(a, b),
      };
      entry.switches.push(i);
      switchedLinks.set(linkKey(a, b), entry);
    }
  });
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
    timedConnections: sorted.territories.flatMap((t) =>
      t.timed
        .filter((m) => t.id < m.id)
        .map(({ id, delay, open, closed }) => ({
          a: t.id,
          b: id,
          delay,
          open,
          closed,
        })),
    ),
    directionalConnections: sorted.territories.flatMap((t) =>
      t.directional
        .filter((m) => m.out)
        .map(({ id, forward, backward }) => ({
          a: t.id,
          b: id,
          forward,
          backward,
        })),
    ),
    switches: switchVertices.map((t) => ({
      x: t.x,
      y: t.y,
      on: t.switch!.on,
      neighbors: t.neighbors.map(newId),
    })),
    switchedLinks: [...switchedLinks.values()],
    lockedTiles: toLockedTiles(
      lockedLinks(tiles, territories),
      new Map([...sorted.idMap].filter(([, id]) => id < newTerritories.length)),
      sorted.territories.length,
    ),
    fixedTiles: tiles
      .filter((tile) => !tile.unlockable)
      .map((tile) => ({
        id: sorted.idMap.get(tile.territoryId)!,
        points: roundedPoints(tile.points),
        color: tile.color,
      })),
    territoryNames: sorted.territories
      .filter((t) => !t.isSea)
      .map((t) => t.name.trim()),
    seaNames: sorted.territories
      .filter((t) => t.isSea)
      .map((t) => t.name.trim()),
    continentNames: sorted.continentNames.map((name) => name.trim()),
  };
}
