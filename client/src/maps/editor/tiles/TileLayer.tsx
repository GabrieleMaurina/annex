import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { playSound } from '../../../lib/sounds';
import { CURSOR_GRAB, CURSOR_GRABBING } from '../../../ui/cursors/cursors';
import type { Viewport } from '../paint/PaintLayer';
import {
  TILE_FILL,
  tileCenter,
  type EditorTile,
  type TilePoint,
} from './editorTiles';
import { centeredTile, kindPolygon, placeTile, tileAt } from './snapTiles';
import { gridTiles } from './tileGrid';
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

interface GridDrag {
  seed: TilePoint[];
  tiles: TilePoint[][];
  free: (points: TilePoint[]) => boolean;
  last: ClientPoint;
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
  const gridRef = useRef<GridDrag | null>(null);
  const lastClickRef = useRef<{ index: number; at: number } | null>(null);
  const tilesRef = useRef(tiles);
  const refreshGridRef = useRef(refreshGrid);
  useEffect(() => {
    tilesRef.current = tiles;
    refreshGridRef.current = refreshGrid;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const grid = gridRef.current;
      if (grid && e.key === 'Control') refreshGridRef.current(e.ctrlKey);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

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

  function ghostOf(points: TilePoint[]): EditorTile {
    return {
      points,
      unlockable,
      territoryId: GHOST_TERRITORY,
      color: TILE_FILL,
    };
  }

  function seedAt(p: TilePoint): TilePoint[] {
    return placeTile(
      tiles.list,
      tiles.guides,
      kindPolygon(kind, tiles.side),
      p,
      null,
    );
  }

  function hover(e: ClientPoint) {
    const p = toImage(e);
    const hit = tileAt(tiles.list, p);
    setCursor(e.ctrlKey ? CURSOR_GRAB : hit === null ? 'crosshair' : 'move');
    tiles.redraw({
      ghosts: hit === null && !e.ctrlKey ? [ghostOf(seedAt(p))] : [],
    });
  }

  function refreshGrid(line: boolean) {
    const grid = gridRef.current;
    if (!grid) return;
    const candidates = gridTiles(grid.seed, toImage(grid.last), line);
    grid.tiles =
      candidates.length > 1 ? candidates.filter(grid.free) : [grid.seed];
    tiles.redraw({ ghosts: grid.tiles.map(ghostOf) });
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
      const seed = seedAt(p);
      gridRef.current = {
        seed,
        tiles: [seed],
        free: tiles.freeCheck(),
        last: { clientX: e.clientX, clientY: e.clientY },
      };
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
      before: tiles.neighborsOf(hit),
      points: null,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      onPanMove(e.clientX, e.clientY);
      return;
    }
    const grid = gridRef.current;
    if (grid) {
      grid.last = { clientX: e.clientX, clientY: e.clientY };
      refreshGrid(e.ctrlKey);
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
    const grid = gridRef.current;
    gridRef.current = null;
    if (grid) {
      if (grid.tiles.length > 0) tiles.add(grid.tiles);
      else hover(e);
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
    gridRef.current = null;
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
