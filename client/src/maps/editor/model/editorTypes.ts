import type { MapSeaTerritory, MapTerritory } from '../../../lib/types';

export interface EditorTerritory extends MapTerritory {
  isSea?: boolean;
}

export const SEA_BRUSH = -1;

export function toEditorTerritories(
  territories: MapTerritory[],
  seaTerritories: MapSeaTerritory[],
): EditorTerritory[] {
  return [
    ...territories,
    ...seaTerritories.map((s) => ({ ...s, continentId: 0, isSea: true })),
  ];
}
