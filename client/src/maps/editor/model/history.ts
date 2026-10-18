import type { GenerateMapInput } from '../../../lib/types';
import type { Shape } from '../paint/PaintLayer';
import type { EditorTerritory } from './editorTypes';

export interface GraphState {
  territories: EditorTerritory[];
  bonuses: number[];
  continentCount: number;
  borderColors: string[];
  generation: GenerateMapInput | null;
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
    continentCount: s.continentCount,
    borderColors: s.borderColors,
    generation: s.generation,
  };
}

export function graphKeyOf(s: GraphState): string {
  return JSON.stringify(graphOf(s));
}
