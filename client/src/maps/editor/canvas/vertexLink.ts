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
import { withoutStaleWires } from '../model/switches';
import { NO_WRAP, segmentWouldCross, type Viewport } from './canvasGeometry';

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

function canTouchSwitch(t: Territory): boolean {
  return !t.isSea && !t.locked && !t.switch;
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
  const fromTerritory = territories.find((t) => t.id === selectedVertexId);
  if (!fromTerritory) {
    setSelectedVertexId(id);
    return;
  }
  if (selectedVertexId === id) {
    setSelectedVertexId(null);
    return;
  }
  const from = fromTerritory.id;
  const toTerritory = territories.find((t) => t.id === id);
  const switchPair = !!(fromTerritory.switch || toTerritory?.switch);
  const wrap = switchPair ? NO_WRAP : forced;
  const mode =
    switchPair || linkMode === 'switch' || linkMode === 'select'
      ? 'normal'
      : linkMode;
  const linked = fromTerritory.neighbors.includes(id);
  const timedLinked = fromTerritory.timed.some((m) => m.id === id);
  const directionalLinked = fromTerritory.directional.some((m) => m.id === id);
  const exists = linked || timedLinked || directionalLinked;
  const remove =
    mode === 'timed'
      ? timedLinked
      : mode === 'directional'
        ? directionalLinked
        : linked;
  if (
    switchPair &&
    !remove &&
    toTerritory &&
    !canTouchSwitch(fromTerritory.switch ? toTerritory : fromTerritory)
  ) {
    flashRejectedEdge(ctx, fromTerritory, toTerritory, wrap);
    setSelectedVertexId(id);
    return;
  }
  if (
    !exists &&
    !allowCrossover &&
    toTerritory &&
    edgeWouldCross(ctx, fromTerritory, toTerritory, wrap)
  ) {
    flashRejectedEdge(ctx, fromTerritory, toTerritory, wrap);
    setSelectedVertexId(id);
    return;
  }
  if (
    mode !== 'normal' &&
    !remove &&
    toTerritory &&
    (fromTerritory.isSea || toTerritory.isSea)
  ) {
    flashRejectedEdge(ctx, fromTerritory, toTerritory, wrap);
    setSelectedVertexId(id);
    return;
  }
  const wrapMarks = (otherId: number): WrapMark[] =>
    !exists && (wrap.x || wrap.y)
      ? [{ id: otherId, x: wrap.x, y: wrap.y }]
      : [];
  const relink = (t: Territory, otherId: number, out: boolean): Territory => ({
    ...t,
    neighbors: [
      ...t.neighbors.filter((n) => n !== otherId),
      ...(mode === 'normal' && !remove ? [otherId] : []),
    ],
    timed: [
      ...t.timed.filter((m) => m.id !== otherId),
      ...(mode === 'timed' && !remove
        ? [{ id: otherId, ...DEFAULT_TIMED }]
        : []),
    ],
    directional: [
      ...t.directional.filter((m) => m.id !== otherId),
      ...(mode === 'directional' && !remove
        ? [{ id: otherId, out, ...DEFAULT_DIRECTIONAL }]
        : []),
    ],
    wraps:
      exists && !remove
        ? t.wraps
        : [...t.wraps.filter((w) => w.id !== otherId), ...wrapMarks(otherId)],
  });
  setTerritories((ts) =>
    withoutStaleWires(
      ts.map((t) =>
        t.id === from
          ? relink(t, id, true)
          : t.id === id
            ? relink(t, from, false)
            : t,
      ),
    ),
  );
  setSelectedVertexId(id);
}
