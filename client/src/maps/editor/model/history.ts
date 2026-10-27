import type { GenerateMapInput } from '../../../lib/types';
import type { Shape } from '../paint/shapes';
import type { EditorTerritory } from './editorTypes';
import type { EditorLockedTile } from './lockedTiles';

export interface GraphState {
  territories: EditorTerritory[];
  bonuses: number[];
  continentNames: string[];
  continentCount: number;
  borderColors: string[];
  generation: GenerateMapInput | null;
  lockedTiles: EditorLockedTile[];
}

export interface HistoryEntry extends GraphState {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  shape: Shape | null;
  graphKey: string;
}

export function graphOf(s: GraphState): GraphState {
  return {
    territories: s.territories,
    bonuses: s.bonuses,
    continentNames: s.continentNames,
    continentCount: s.continentCount,
    borderColors: s.borderColors,
    generation: s.generation,
    lockedTiles: s.lockedTiles,
  };
}

export function graphKeyOf(s: GraphState): string {
  return JSON.stringify(graphOf(s));
}
