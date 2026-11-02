import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { WrapAxes } from '../../../game/mapMath';
import { wrapEdgeSegments, type Point } from '../mapCanvasGeometry';
import {
  DEFAULT_DIRECTIONAL,
  DEFAULT_TIMED,
  type LinkMode,
  type EditorTerritory as Territory,
  type WrapMark,
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
  linkMode: LinkMode;
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
  const {
    territories,
    selectedVertexId,
    setSelectedVertexId,
    setTerritories,
    linkMode,
  } = ctx;
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
  const timedLinked = fromTerritory
    ? fromTerritory.timed.some((m) => m.id === id)
    : false;
  const directionalLinked = fromTerritory
    ? fromTerritory.directional.some((m) => m.id === id)
    : false;
  const exists = linked || timedLinked || directionalLinked;
  const remove =
    linkMode === 'timed'
      ? timedLinked
      : linkMode === 'directional'
        ? directionalLinked
        : linked;
  if (
    !exists &&
    !allowCrossover &&
    fromTerritory &&
    toTerritory &&
    edgeWouldCross(ctx, fromTerritory, toTerritory, forced)
  ) {
    flashRejectedEdge(ctx, fromTerritory, toTerritory, forced);
    setSelectedVertexId(id);
    return;
  }
  if (
    linkMode !== 'normal' &&
    !remove &&
    fromTerritory &&
    toTerritory &&
    (fromTerritory.isSea || toTerritory.isSea)
  ) {
    flashRejectedEdge(ctx, fromTerritory, toTerritory, forced);
    setSelectedVertexId(id);
    return;
  }
  const wrapMarks = (otherId: number): WrapMark[] =>
    !exists && (forced.x || forced.y)
      ? [{ id: otherId, x: forced.x, y: forced.y }]
      : [];
  const relink = (t: Territory, otherId: number, out: boolean): Territory => ({
    ...t,
    neighbors: [
      ...t.neighbors.filter((n) => n !== otherId),
      ...(linkMode === 'normal' && !remove ? [otherId] : []),
    ],
    timed: [
      ...t.timed.filter((m) => m.id !== otherId),
      ...(linkMode === 'timed' && !remove
        ? [{ id: otherId, ...DEFAULT_TIMED }]
        : []),
    ],
    directional: [
      ...t.directional.filter((m) => m.id !== otherId),
      ...(linkMode === 'directional' && !remove
        ? [{ id: otherId, out, ...DEFAULT_DIRECTIONAL }]
        : []),
    ],
    wraps:
      exists && !remove
        ? t.wraps
        : [...t.wraps.filter((w) => w.id !== otherId), ...wrapMarks(otherId)],
  });
  setTerritories((ts) =>
    ts.map((t) =>
      t.id === from
        ? relink(t, id, true)
        : t.id === id
          ? relink(t, from, false)
          : t,
    ),
  );
  setSelectedVertexId(id);
}
