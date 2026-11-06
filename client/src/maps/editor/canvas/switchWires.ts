import type { Point } from '../mapCanvasGeometry';
import type {
  LinkMode,
  EditorTerritory as Territory,
} from '../model/editorTypes';
import { withWireToggled } from '../model/switches';
import type { Viewport } from './canvasGeometry';
import { linkAt } from './graphPick';

export function wireAt(
  territories: Territory[],
  selectedId: number | null,
  linkMode: LinkMode,
  viewport: Viewport,
  pos: Point,
): Territory[] | null {
  if ((linkMode !== 'switch' && linkMode !== 'select') || selectedId === null)
    return null;
  if (!territories.find((t) => t.id === selectedId)?.switch) return null;
  const link = linkAt(territories, viewport, pos, true);
  return link && withWireToggled(territories, selectedId, link);
}
