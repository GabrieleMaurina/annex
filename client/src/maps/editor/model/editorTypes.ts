import type {
  MapSeaTerritory,
  MapTerritory,
  MapWrap,
} from '../../../lib/types';

export interface WrapMark {
  id: number;
  x: boolean;
  y: boolean;
}

export interface EditorTerritory extends MapTerritory {
  isSea?: boolean;
  wraps: WrapMark[];
}

export const NO_CONTINENT = -1;
export const SEA_BRUSH = -2;

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
): EditorTerritory[] {
  const marksOf = (id: number): WrapMark[] =>
    wraps.flatMap((w) => {
      if (w.a === id) return [{ id: w.b, x: w.x, y: w.y }];
      if (w.b === id) return [{ id: w.a, x: w.x, y: w.y }];
      return [];
    });
  return [
    ...territories.map((t) => ({ ...t, wraps: marksOf(t.id) })),
    ...seaTerritories.map((s) => ({
      ...s,
      continentId: 0,
      isSea: true,
      wraps: marksOf(s.id),
    })),
  ];
}
