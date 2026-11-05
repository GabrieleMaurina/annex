import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { playSound } from '../../../lib/sounds';
import { CURSOR_GRAB, CURSOR_GRABBING } from '../../../ui/cursors/cursors';
import type { Viewport } from '../paint/PaintLayer';
import {
  TILE_FILL,
  tileCenter,
  tileNeighbors,
  type EditorTile,
  type TilePoint,
} from './editorTiles';
import { centeredTile, kindPolygon, placeTile, tileAt } from './snapTiles';
import type { TilesApi } from './useTiles';

interface Props {
  tiles: TilesApi;
  viewportRef: MutableRefObject<Viewport>;
  onWheelZoom: (clientX: number, clientY: number, deltaY: number) => void;
  onPanStart: (clientX: number, clientY: number) => void;
  onPanMove: (clientX: number, clientY: number) => void;
  onPanEnd: () => void;
}

interface TileDrag {
  index: number;
  grab: TilePoint;
  before: number[];
  points: TilePoint[] | null;
}

interface ClientPoint {
  clientX: number;
  clientY: number;
  ctrlKey?: boolean;
}

const DOUBLE_CLICK_MS = 300;
const GHOST_TERRITORY = -1;

function TileLayer({
  tiles,
  viewportRef,
  onWheelZoom,
  onPanStart,
  onPanMove,
  onPanEnd,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(false);
  const dragRef = useRef<TileDrag | null>(null);
  const lastClickRef = useRef<{ index: number; at: number } | null>(null);
  const tilesRef = useRef(tiles);
  useEffect(() => {
    tilesRef.current = tiles;
  });

  const { kind, unlockable } = tiles.options;
  useEffect(() => {
    const pointer = tiles.pointerRef.current;
    if (pointer && !dragRef.current && !panRef.current) hover(pointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles.list, kind, unlockable]);

  useEffect(() => () => tilesRef.current.redraw(null), []);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      onWheelZoom(e.clientX, e.clientY, e.deltaY);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheelZoom]);

  function setCursor(value: string) {
    if (divRef.current) divRef.current.style.cursor = value;
  }

  function toImage(e: ClientPoint): TilePoint {
    const vp = viewportRef.current;
    const rect = divRef.current!.getBoundingClientRect();
    return [
      (e.clientX - rect.left - vp.offsetX) / vp.scaleX,
      (e.clientY - rect.top - vp.offsetY) / vp.scaleY,
    ];
  }

  function ghostAt(p: TilePoint): EditorTile {
    return {
      points: placeTile(
        tiles.list,
        tiles.guides,
        kindPolygon(kind, tiles.side),
        p,
        null,
      ),
      unlockable,
      territoryId: GHOST_TERRITORY,
      color: TILE_FILL,
    };
  }

  function hover(e: ClientPoint) {
    const p = toImage(e);
    const hit = tileAt(tiles.list, p);
    setCursor(e.ctrlKey ? CURSOR_GRAB : hit === null ? 'crosshair' : 'move');
    tiles.redraw({
      ghost: hit === null && !e.ctrlKey ? ghostAt(p) : null,
    });
  }

  function isDoubleClick(index: number): boolean {
    const last = lastClickRef.current;
    const now = Date.now();
    const double = last?.index === index && now - last.at < DOUBLE_CLICK_MS;
    lastClickRef.current = double ? null : { index, at: now };
    return double;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button === 0 && e.ctrlKey) {
      divRef.current?.setPointerCapture(e.pointerId);
      panRef.current = true;
      setCursor(CURSOR_GRABBING);
      tiles.redraw(null);
      onPanStart(e.clientX, e.clientY);
      return;
    }
    const p = toImage(e);
    const hit = tileAt(tiles.list, p);
    if (e.button === 2) {
      if (hit === null) return;
      playSound('click');
      tiles.toggle(hit);
      return;
    }
    if (e.button !== 0) return;
    divRef.current?.setPointerCapture(e.pointerId);
    playSound('click');
    if (hit === null) {
      lastClickRef.current = null;
      tiles.add(ghostAt(p).points);
      return;
    }
    if (isDoubleClick(hit)) {
      tiles.remove(hit);
      return;
    }
    tiles.select(hit);
    const [cx, cy] = tileCenter(tiles.list[hit].points);
    dragRef.current = {
      index: hit,
      grab: [p[0] - cx, p[1] - cy],
      before: tileNeighbors(tiles.list, tiles.list[hit].points, hit),
      points: null,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      onPanMove(e.clientX, e.clientY);
      return;
    }
    const drag = dragRef.current;
    if (!drag) {
      hover(e);
      return;
    }
    const p = toImage(e);
    drag.points = placeTile(
      tiles.list,
      tiles.guides,
      centeredTile(tiles.list[drag.index].points),
      [p[0] - drag.grab[0], p[1] - drag.grab[1]],
      drag.index,
    );
    tiles.drag(drag.index, drag.points);
  }

  function onPointerUp(e: React.PointerEvent) {
    divRef.current?.releasePointerCapture(e.pointerId);
    if (panRef.current) {
      panRef.current = false;
      onPanEnd();
      hover(e);
      return;
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.points) tiles.move(drag.index, drag.points, drag.before);
    else hover(e);
  }

  function onPointerCancel() {
    if (panRef.current) onPanEnd();
    panRef.current = false;
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.points) tiles.move(drag.index, drag.points, drag.before);
    tiles.redraw(null);
  }

  function onPointerLeave() {
    if (!dragRef.current && !panRef.current) tiles.redraw(null);
  }

  return (
    <div
      ref={divRef}
      className="position-fixed top-0 bottom-0 start-0 end-0 z-1"
      style={{ touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

export default TileLayer;
