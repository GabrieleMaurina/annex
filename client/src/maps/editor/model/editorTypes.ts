import type {
  MapSeaTerritory,
  MapTerritory,
  MapWrap,
  TimedConnection,
} from '../../../lib/types';

export interface WrapMark {
  id: number;
  x: boolean;
  y: boolean;
}

export interface TimedMark {
  id: number;
  delay: number;
  open: number;
  closed: number;
}

export interface EditorTerritory extends MapTerritory {
  isSea?: boolean;
  wraps: WrapMark[];
  timed: TimedMark[];
}

export const DEFAULT_TIMED = { delay: 0, open: 1, closed: 1 };

export const NO_CONTINENT = -1;
export const SEA_BRUSH = -2;

export function nextTerritoryId(territories: EditorTerritory[]): number {
  return territories.length ? Math.max(...territories.map((t) => t.id)) + 1 : 0;
}

export function newTerritory(
  id: number,
  x: number,
  y: number,
  brushId: number,
  continentCount: number,
): EditorTerritory {
  const isSea = brushId === SEA_BRUSH;
  return {
    id,
    continentId: isSea ? 0 : Math.min(brushId, continentCount - 1),
    x,
    y,
    neighbors: [],
    wraps: [],
    timed: [],
    isSea,
  };
}

export function nextInContinentCycle(
  current: number,
  continentCount: number,
): number {
  if (current === SEA_BRUSH) return continentCount > 0 ? 0 : NO_CONTINENT;
  if (current === NO_CONTINENT) return SEA_BRUSH;
  if (current + 1 >= continentCount) return NO_CONTINENT;
  return current + 1;
}

export function toEditorTerritories(
  territories: MapTerritory[],
  seaTerritories: MapSeaTerritory[],
  wraps: MapWrap[],
  timedConnections: TimedConnection[],
): EditorTerritory[] {
  const marksOf = (id: number): WrapMark[] =>
    wraps.flatMap((w) => {
      if (w.a === id) return [{ id: w.b, x: w.x, y: w.y }];
      if (w.b === id) return [{ id: w.a, x: w.x, y: w.y }];
      return [];
    });
  const timedOf = (id: number): TimedMark[] =>
    timedConnections.flatMap(({ a, b, ...values }) => {
      if (a === id) return [{ id: b, ...values }];
      if (b === id) return [{ id: a, ...values }];
      return [];
    });
  return [
    ...territories.map((t) => ({
      ...t,
      wraps: marksOf(t.id),
      timed: timedOf(t.id),
    })),
    ...seaTerritories.map((s) => ({
      ...s,
      continentId: 0,
      isSea: true,
      wraps: marksOf(s.id),
      timed: timedOf(s.id),
    })),
  ];
}

export function withoutVertex(
  territories: EditorTerritory[],
  id: number,
): EditorTerritory[] {
  return territories
    .filter((t) => t.id !== id)
    .map((t) => ({
      ...t,
      neighbors: t.neighbors.filter((n) => n !== id),
      wraps: t.wraps.filter((w) => w.id !== id),
      timed: t.timed.filter((m) => m.id !== id),
    }));
}
