import {
  pointToSegmentDistance,
  wrapEdgeSegments,
  type Point,
} from '../mapCanvasGeometry';
import type { EditorTerritory as Territory } from '../model/editorTypes';
import { getVertexRadius, wrapOf, type Viewport } from './canvasGeometry';

export type GraphPick =
  | { kind: 'link'; a: number; b: number }
  | { kind: 'continent'; id: number }
  | null;

export type GraphSelection =
  { kind: 'vertex'; id: number } | Exclude<GraphPick, null>;

export interface ContinentLabel {
  id: number;
  x: number;
  y: number;
  text: string;
}

const LABEL_FONT_RADII = 0.9;
const LABEL_CHAR_WIDTH = 0.62;
const LABEL_PADDING = 0.6;

function toScreen(viewport: Viewport, p: Point): Point {
  return {
    x: p.x * viewport.scaleX + viewport.offsetX,
    y: p.y * viewport.scaleY + viewport.offsetY,
  };
}

export function continentLabels(
  territories: Territory[],
  continentNames: string[],
): ContinentLabel[] {
  return continentNames.flatMap((name, id) => {
    const members = territories.filter(
      (t) => t.continentId === id && !t.isSea && !t.locked && !t.switch,
    );
    if (members.length === 0) return [];
    return [
      {
        id,
        x: members.reduce((sum, t) => sum + t.x, 0) / members.length,
        y: members.reduce((sum, t) => sum + t.y, 0) / members.length,
        text: name.trim() || `Continent #${id + 1}`,
      },
    ];
  });
}

export function labelFontSize(viewport: Viewport): number {
  return (
    getVertexRadius(viewport.imgW, viewport.imgH) *
    viewport.scaleX *
    LABEL_FONT_RADII
  );
}

export function labelBox(label: ContinentLabel, viewport: Viewport) {
  const font = labelFontSize(viewport);
  const center = toScreen(viewport, label);
  const w = (label.text.length * LABEL_CHAR_WIDTH + LABEL_PADDING * 2) * font;
  const h = font * (1 + LABEL_PADDING);
  return { x: center.x - w / 2, y: center.y - h / 2, w, h };
}

export function linkAt(
  territories: Territory[],
  viewport: Viewport,
  pos: Point,
  scheduledOnly: boolean,
): { a: number; b: number } | null {
  const { imgW, imgH } = viewport;
  const reach = getVertexRadius(imgW, imgH) * viewport.scaleX * 0.6;
  const byId = new Map(territories.map((t) => [t.id, t]));
  for (const t of territories) {
    const ids = [
      ...t.timed.map((m) => m.id),
      ...t.directional.map((m) => m.id),
      ...(scheduledOnly ? [] : t.neighbors),
    ];
    for (const id of ids) {
      const other = byId.get(id);
      if (id < t.id || !other) continue;
      const hit = wrapEdgeSegments(t, other, imgW, imgH, wrapOf(t, id)).some(
        ([a, b]) =>
          pointToSegmentDistance(
            pos,
            toScreen(viewport, a),
            toScreen(viewport, b),
          ) <= reach,
      );
      if (hit) return { a: t.id, b: id };
    }
  }
  return null;
}

export function pickAt(
  territories: Territory[],
  viewport: Viewport,
  pos: Point,
): GraphPick {
  const link = linkAt(territories, viewport, pos, false);
  return link && { kind: 'link', ...link };
}

export function linkSegments(
  byId: Map<number, Territory>,
  a: number,
  b: number,
  viewport: Viewport,
): [Point, Point][] {
  const from = byId.get(a);
  const to = byId.get(b);
  if (!from || !to) return [];
  const linked =
    from.neighbors.includes(b) ||
    [...from.timed, ...from.directional].some((m) => m.id === b);
  if (!linked) return [];
  return wrapEdgeSegments(
    from,
    to,
    viewport.imgW,
    viewport.imgH,
    wrapOf(from, b),
  );
}

export function linkMidpoint(
  byId: Map<number, Territory>,
  a: number,
  b: number,
  viewport: Viewport,
): Point | null {
  const segments = linkSegments(byId, a, b, viewport);
  if (segments.length === 0) return null;
  const [p, q] = segments[Math.floor(segments.length / 2)];
  return toScreen(viewport, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
}

export function selectionAnchor(
  selection: GraphSelection,
  territories: Territory[],
  continentNames: string[],
  viewport: Viewport,
): Point | null {
  const byId = new Map(territories.map((t) => [t.id, t]));
  if (selection.kind === 'vertex') {
    const t = byId.get(selection.id);
    return t ? toScreen(viewport, t) : null;
  }
  if (selection.kind === 'continent') {
    const label = continentLabels(territories, continentNames).find(
      (l) => l.id === selection.id,
    );
    return label ? toScreen(viewport, label) : null;
  }
  return linkMidpoint(byId, selection.a, selection.b, viewport);
}
