import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { WrapAxes } from '../../../game/mapMath';
import { wrapEdgeSegments, type Point } from '../mapCanvasGeometry';
import type {
  EditorTerritory as Territory,
  WrapMark,
} from '../model/editorTypes';
import { segmentWouldCross, type Viewport } from './canvasGeometry';

export interface VertexLinkContext {
  territories: Territory[];
  selectedVertexId: number | null;
  setSelectedVertexId: Dispatch<SetStateAction<number | null>>;
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  setRejectedEdge: Dispatch<SetStateAction<[Point, Point][] | null>>;
  rejectedTimeoutRef: MutableRefObject<number | null>;
  getViewport: () => Viewport;
  getImageDims: () => { w: number; h: number };
}

function edgeWouldCross(
  ctx: VertexLinkContext,
  from: Territory,
  to: Territory,
  forced: WrapAxes,
): boolean {
  return segmentWouldCross(
    ctx.territories,
    ctx.getViewport(),
    from,
    to,
    new Set([from.id, to.id]),
    forced,
  );
}

function flashRejectedEdge(
  ctx: VertexLinkContext,
  from: Territory,
  to: Territory,
  forced: WrapAxes,
) {
  const { w: imgW, h: imgH } = ctx.getImageDims();
  ctx.setRejectedEdge(wrapEdgeSegments(from, to, imgW, imgH, forced));
  if (ctx.rejectedTimeoutRef.current !== null) {
    window.clearTimeout(ctx.rejectedTimeoutRef.current);
  }
  ctx.rejectedTimeoutRef.current = window.setTimeout(
    () => ctx.setRejectedEdge(null),
    300,
  );
}

export function handleVertexClick(
  ctx: VertexLinkContext,
  id: number,
  forced: WrapAxes,
  allowCrossover: boolean,
): void {
  const { territories, selectedVertexId, setSelectedVertexId, setTerritories } =
    ctx;
  if (selectedVertexId === null) {
    setSelectedVertexId(id);
    return;
  }
  if (selectedVertexId === id) {
    setSelectedVertexId(null);
    return;
  }
  const from = selectedVertexId;
  const fromTerritory = territories.find((t) => t.id === from);
  const toTerritory = territories.find((t) => t.id === id);
  const linked = fromTerritory ? fromTerritory.neighbors.includes(id) : false;
  if (
    !linked &&
    !allowCrossover &&
    fromTerritory &&
    toTerritory &&
    edgeWouldCross(ctx, fromTerritory, toTerritory, forced)
  ) {
    flashRejectedEdge(ctx, fromTerritory, toTerritory, forced);
    setSelectedVertexId(id);
    return;
  }
  const wrapMarks = (otherId: number): WrapMark[] =>
    !linked && (forced.x || forced.y)
      ? [{ id: otherId, x: forced.x, y: forced.y }]
      : [];
  setTerritories((ts) =>
    ts.map((t) => {
      if (t.id === from) {
        return {
          ...t,
          neighbors: linked
            ? t.neighbors.filter((n) => n !== id)
            : [...t.neighbors, id],
          wraps: [...t.wraps.filter((w) => w.id !== id), ...wrapMarks(id)],
        };
      }
      if (t.id === id) {
        return {
          ...t,
          neighbors: linked
            ? t.neighbors.filter((n) => n !== from)
            : [...t.neighbors, from],
          wraps: [...t.wraps.filter((w) => w.id !== from), ...wrapMarks(from)],
        };
      }
      return t;
    }),
  );
  setSelectedVertexId(id);
}
