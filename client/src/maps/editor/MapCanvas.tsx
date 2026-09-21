import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { WrapAxes } from '../../game/mapMath';
import { hitVertex, NO_WRAP, wrapAxesOf } from './canvas/canvasGeometry';
import { drawGraph } from './canvas/drawGraph';
import {
  handleVertexClick as linkVertices,
  type VertexLinkContext,
} from './canvas/vertexLink';
import { DEFAULT_IMAGE_HEIGHT, DEFAULT_IMAGE_WIDTH } from './defaultImage';
import { touchDistance, touchMidpoint, type Point } from './mapCanvasGeometry';
import {
  clamp,
  createSettleSampler,
  easeOutCubic,
  screenOffset,
  zoomTransform,
} from './mapViewport';
import {
  nextInContinentCycle,
  SEA_BRUSH,
  type EditorTerritory as Territory,
} from './model/editorTypes';
import { drawFreehand, paintContext, type Rect } from './paint/paintTools';

interface Props {
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentCount: number;
  imageSrc: string;
  currentContinentId: number;
  setCurrentContinentId: Dispatch<SetStateAction<number>>;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  paintCanvas?: HTMLCanvasElement | null;
  paintSurfaceRef?: MutableRefObject<ImageData>;
  paintVersion?: number;
  paintSize?: number;
  onPaintChange?: () => void;
  onPaintStrokeEnd?: () => void;
  disabled?: boolean;
  panOnly?: boolean;
  hideImage?: boolean;
  hideGraph?: boolean;
  resort: (next: Territory[]) => Map<number, number>;
  onViewport?: (v: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
  }) => void;
}

interface Transform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

type DragState =
  | { type: 'pan'; startPos: Point; startTransform: Point; moved: boolean }
  | {
      type: 'vertex';
      id: number;
      startPos: Point;
      lastPos: Point;
      moved: boolean;
    }
  | null;

const DRAG_THRESHOLD = 4;
const SETTLE_DURATION = 200;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 24;

const SYNTHETIC_MOUSE_WINDOW_MS = 500;
const LONG_PRESS_MS = 500;
const LONG_PRESS_REPEAT_MS = 2000;

export interface MapCanvasHandle {
  zoomAt: (clientX: number, clientY: number, deltaY: number) => void;
  panStart: (clientX: number, clientY: number) => void;
  panMove: (clientX: number, clientY: number) => void;
  panEnd: () => void;
}

const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(
  {
    territories,
    setTerritories,
    continentCount,
    imageSrc,
    currentContinentId,
    setCurrentContinentId,
    setCollapsed,
    paintCanvas,
    paintSurfaceRef,
    paintVersion,
    paintSize,
    onPaintChange,
    onPaintStrokeEnd,
    disabled,
    panOnly,
    hideImage,
    hideGraph,
    resort,
    onViewport,
  }: Props,
  ref,
) {
  void paintVersion;
  const brushContinentId = Math.min(currentContinentId, continentCount - 1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const pinchRef = useRef<{ lastDistance: number } | null>(null);
  const settleRef = useRef<number | null>(null);
  const lastTouchAtRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const lastTapPosRef = useRef<Point>({ x: 0, y: 0 });
  const lastAddedVertexRef = useRef<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const cycleContinentAtRef = useRef<(pos: Point) => void>(() => {});
  const applyResortRef = useRef<(next: Territory[]) => Map<number, number>>(
    () => new Map(),
  );
  const eraseRef = useRef<Point[] | null>(null);
  const forcePanRef = useRef<{ startPos: Point; startTransform: Point } | null>(
    null,
  );
  const panStartImplRef = useRef<(clientX: number, clientY: number) => void>(
    () => {},
  );
  const panMoveImplRef = useRef<(clientX: number, clientY: number) => void>(
    () => {},
  );
  const panEndImplRef = useRef(() => {});
  const dragMoveHandlerRef = useRef<(e: MouseEvent) => void>(() => {});
  const dragUpHandlerRef = useRef<(e: MouseEvent) => void>(() => {});
  const windowMouseMoveRef = useRef((e: MouseEvent) =>
    dragMoveHandlerRef.current(e),
  );
  const windowMouseUpRef = useRef((e: MouseEvent) =>
    dragUpHandlerRef.current(e),
  );
  const [transform, setTransform] = useState<Transform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [selectedVertexId, setSelectedVertexId] = useState<number | null>(null);
  const [hoveredVertexId, setHoveredVertexId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point | null>(null);
  const [forceWrap, setForceWrap] = useState<WrapAxes>(NO_WRAP);
  const [rejectedEdge, setRejectedEdge] = useState<[Point, Point][] | null>(
    null,
  );
  const rejectedTimeoutRef = useRef<number | null>(null);
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const disabledRef = useRef(!!disabled);
  const panOnlyRef = useRef(!!panOnly);
  const territoriesRef = useRef(territories);
  useEffect(() => {
    disabledRef.current = !!disabled;
    panOnlyRef.current = !!panOnly;
    territoriesRef.current = territories;
  });

  const [prevDisabled, setPrevDisabled] = useState(!!disabled);
  if (!!disabled !== prevDisabled) {
    setPrevDisabled(!!disabled);
    if (disabled && selectedVertexId !== null) setSelectedVertexId(null);
  }

  function getImageDims(): { w: number; h: number } {
    const img = imageRef.current;
    return img
      ? { w: img.naturalWidth, h: img.naturalHeight }
      : { w: DEFAULT_IMAGE_WIDTH, h: DEFAULT_IMAGE_HEIGHT };
  }

  function getScales(canvasW: number, canvasH: number, zoom: number) {
    const { w: imgW, h: imgH } = getImageDims();
    const scale = Math.min(canvasW / imgW, canvasH / imgH) * zoom;
    return {
      imgW,
      imgH,
      scaleX: scale,
      scaleY: scale,
    };
  }

  function getScreenOffset(
    canvasW: number,
    canvasH: number,
    zoom: number,
    panX: number,
    panY: number,
  ) {
    const { imgW, imgH, scaleX, scaleY } = getScales(canvasW, canvasH, zoom);
    return screenOffset(
      canvasW,
      canvasH,
      scaleX,
      scaleY,
      imgW,
      imgH,
      panX,
      panY,
    );
  }

  function getViewport() {
    const canvas = canvasRef.current!;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const { imgW, imgH, scaleX, scaleY } = getScales(w, h, transform.zoom);
    const { x: offsetX, y: offsetY } = getScreenOffset(
      w,
      h,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
    return { imgW, imgH, scaleX, scaleY, offsetX, offsetY };
  }

  const cancelSettle = useCallback(() => {
    if (settleRef.current !== null) {
      cancelAnimationFrame(settleRef.current);
      settleRef.current = null;
    }
  }, []);

  const resetView = useCallback(() => {
    cancelSettle();
    setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
  }, [cancelSettle]);

  function startSettle() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelSettle();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const { offsetX, offsetY } = transform;
    const { imgW, imgH, scaleX, scaleY } = getScales(w, h, transform.zoom);
    const settle = createSettleSampler(
      w,
      h,
      scaleX,
      scaleY,
      imgW,
      imgH,
      offsetX,
      offsetY,
    );
    const { target } = settle;
    if (settle.settled) {
      if (offsetX !== target.x || offsetY !== target.y) {
        setTransform((t) => ({ ...t, offsetX: target.x, offsetY: target.y }));
      }
      return;
    }
    const begin = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - begin) / SETTLE_DURATION, 1);
      if (progress >= 1) {
        setTransform((t) => ({ ...t, offsetX: target.x, offsetY: target.y }));
        settleRef.current = null;
        return;
      }
      const next = settle.sample(easeOutCubic(progress));
      setTransform((t) => ({ ...t, offsetX: next.x, offsetY: next.y }));
      settleRef.current = requestAnimationFrame(animate);
    };
    settleRef.current = requestAnimationFrame(animate);
  }

  function panStartImpl(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelSettle();
    const rect = canvas.getBoundingClientRect();
    forcePanRef.current = {
      startPos: { x: clientX - rect.left, y: clientY - rect.top },
      startTransform: { x: transform.offsetX, y: transform.offsetY },
    };
  }
  panStartImplRef.current = panStartImpl;

  function panMoveImpl(clientX: number, clientY: number) {
    const drag = forcePanRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = clientX - rect.left - drag.startPos.x;
    const dy = clientY - rect.top - drag.startPos.y;
    setTransform((t) => ({
      ...t,
      offsetX: drag.startTransform.x + dx,
      offsetY: drag.startTransform.y + dy,
    }));
  }
  panMoveImplRef.current = panMoveImpl;

  function panEndImpl() {
    if (!forcePanRef.current) return;
    forcePanRef.current = null;
    startSettle();
  }
  panEndImplRef.current = panEndImpl;

  useEffect(() => {
    let stale = false;
    const img = new Image();
    img.onload = () => {
      if (stale) return;
      imageRef.current = img;
      setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
    };
    img.src = imageSrc;
    return () => {
      stale = true;
    };
  }, [imageSrc]);

  useEffect(() => {
    function handleResize() {
      setSize({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(
    () => () => {
      if (settleRef.current !== null) cancelAnimationFrame(settleRef.current);
    },
    [],
  );

  useEffect(() => () => detachWindowDragListeners(), []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', resetView);
    return () => document.removeEventListener('fullscreenchange', resetView);
  }, [resetView]);

  const syncForceWrap = useCallback(
    (e: { ctrlKey: boolean; shiftKey: boolean }) => {
      const next = wrapAxesOf(e);
      setForceWrap((prev) =>
        prev.x === next.x && prev.y === next.y ? prev : next,
      );
    },
    [],
  );

  useEffect(() => {
    window.addEventListener('keydown', syncForceWrap);
    window.addEventListener('keyup', syncForceWrap);
    return () => {
      window.removeEventListener('keydown', syncForceWrap);
      window.removeEventListener('keyup', syncForceWrap);
    };
  }, [syncForceWrap]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedVertexId !== null) setSelectedVertexId(null);
        else if (!disabledRef.current) setCollapsed(true);
        return;
      }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (selectedVertexId === null) return;
      e.preventDefault();
      const id = selectedVertexId;
      const next = territoriesRef.current
        .filter((t) => t.id !== id)
        .map((t) => ({
          ...t,
          neighbors: t.neighbors.filter((n) => n !== id),
          wraps: t.wraps.filter((w) => w.id !== id),
        }));
      applyResortRef.current(next);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVertexId, setCollapsed]);

  const applyZoom = useCallback(
    (pos: Point, factor: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      cancelSettle();
      const canvasW = canvas.clientWidth;
      const canvasH = canvas.clientHeight;
      const img = imageRef.current;
      const imgW = img ? img.naturalWidth : DEFAULT_IMAGE_WIDTH;
      const imgH = img ? img.naturalHeight : DEFAULT_IMAGE_HEIGHT;
      setTransform((prev) =>
        zoomTransform(prev, canvasW, canvasH, imgW, imgH, pos, factor),
      );
    },
    [cancelSettle],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      if (disabledRef.current && !panOnlyRef.current) return;
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      applyZoom(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        e.deltaY < 0 ? 1.1 : 0.9,
      );
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  useImperativeHandle(
    ref,
    () => ({
      zoomAt(clientX: number, clientY: number, deltaY: number) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        applyZoom(
          { x: clientX - rect.left, y: clientY - rect.top },
          deltaY < 0 ? 1.1 : 0.9,
        );
      },
      panStart(clientX: number, clientY: number) {
        panStartImplRef.current(clientX, clientY);
      },
      panMove(clientX: number, clientY: number) {
        panMoveImplRef.current(clientX, clientY);
      },
      panEnd() {
        panEndImplRef.current();
      },
    }),
    [applyZoom],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(size.w * dpr);
    const ch = Math.round(size.h * dpr);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#212529';
    ctx.fillRect(0, 0, size.w, size.h);

    const { zoom } = transform;
    const { imgW, imgH, scaleX, scaleY } = getScales(size.w, size.h, zoom);
    const { x: offsetX, y: offsetY } = getScreenOffset(
      size.w,
      size.h,
      zoom,
      transform.offsetX,
      transform.offsetY,
    );

    onViewport?.({ offsetX, offsetY, scaleX, scaleY });

    if (paintCanvas && !hideImage) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        paintCanvas,
        offsetX,
        offsetY,
        imgW * scaleX,
        imgH * scaleY,
      );
    }

    if (!hideGraph) {
      drawGraph({
        ctx,
        viewport: { imgW, imgH, scaleX, scaleY, offsetX, offsetY },
        zoom,
        territories,
        rejectedEdge,
        selectedVertexId,
        hoveredVertexId,
        mouseWorldPos,
        dragging: dragRef.current !== null,
        forceWrap,
      });
    }
  });

  function getPos(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function erasePaint(pos: Point) {
    const points = eraseRef.current;
    const paintSurface = paintSurfaceRef?.current ?? null;
    if (!points || !paintCanvas || !paintSurface) return;
    const ctx = paintContext(paintCanvas);
    if (!ctx) return;
    const { scaleX, scaleY, offsetX, offsetY } = getViewport();
    points.push({
      x: (pos.x - offsetX) / scaleX,
      y: (pos.y - offsetY) / scaleY,
    });
    const rect: Rect = drawFreehand(
      paintSurface,
      'eraser',
      '#ffffff',
      paintSize ?? 6,
      points.slice(-2),
    );
    if (rect.w > 0 && rect.h > 0)
      ctx.putImageData(paintSurface, 0, 0, rect.x, rect.y, rect.w, rect.h);
    onPaintChange?.();
  }

  function endErase() {
    if (!eraseRef.current) return;
    eraseRef.current = null;
    onPaintStrokeEnd?.();
  }

  function applyResort(next: Territory[]): Map<number, number> {
    const idMap = resort(next);
    setSelectedVertexId((id) => (id === null ? null : (idMap.get(id) ?? null)));
    setHoveredVertexId((id) => (id === null ? null : (idMap.get(id) ?? null)));
    if (lastAddedVertexRef.current !== null) {
      lastAddedVertexRef.current =
        idMap.get(lastAddedVertexRef.current) ?? null;
    }
    return idMap;
  }
  applyResortRef.current = applyResort;

  function addVertexAt(pos: Point): number {
    const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = getViewport();
    const worldX = clamp((pos.x - offsetX) / scaleX, 0, imgW);
    const worldY = clamp((pos.y - offsetY) / scaleY, 0, imgH);
    const nextId = territories.length
      ? Math.max(...territories.map((t) => t.id)) + 1
      : 0;
    const isSea = currentContinentId === SEA_BRUSH;
    const next = [
      ...territories,
      {
        id: nextId,
        continentId: isSea ? 0 : brushContinentId,
        x: worldX,
        y: worldY,
        neighbors: [],
        wraps: [],
        isSea,
      },
    ];
    const idMap = applyResort(next);
    const newId = idMap.get(nextId)!;
    setHoveredVertexId(newId);
    return newId;
  }

  function handleVertexClick(
    id: number,
    forced: WrapAxes,
    allowCrossover: boolean,
  ) {
    const ctx: VertexLinkContext = {
      territories,
      selectedVertexId,
      setSelectedVertexId,
      setTerritories,
      setRejectedEdge,
      rejectedTimeoutRef,
      getViewport,
      getImageDims,
    };
    linkVertices(ctx, id, forced, allowCrossover);
  }

  function isSyntheticMouse(): boolean {
    return Date.now() - lastTouchAtRef.current < SYNTHETIC_MOUSE_WINDOW_MS;
  }

  function clearLongPress() {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function beginPointer(pos: Point) {
    attachWindowDragListeners();
    if (panOnlyRef.current) {
      cancelSettle();
      dragRef.current = {
        type: 'pan',
        startPos: pos,
        startTransform: { x: transform.offsetX, y: transform.offsetY },
        moved: false,
      };
      return;
    }
    const vertex = hitVertex(territories, getViewport(), pos);
    if (vertex) {
      dragRef.current = {
        type: 'vertex',
        id: vertex.id,
        startPos: pos,
        lastPos: pos,
        moved: false,
      };
      return;
    }
    cancelSettle();
    dragRef.current = {
      type: 'pan',
      startPos: pos,
      startTransform: { x: transform.offsetX, y: transform.offsetY },
      moved: false,
    };
  }

  function dragPointer(pos: Point) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'pan') {
      const dx = pos.x - drag.startPos.x;
      const dy = pos.y - drag.startPos.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
      if (drag.moved) {
        setTransform((t) => ({
          ...t,
          offsetX: drag.startTransform.x + dx,
          offsetY: drag.startTransform.y + dy,
        }));
        setIsDragging(true);
      }
    } else {
      const { imgW, imgH, scaleX, scaleY } = getViewport();
      const dx = pos.x - drag.lastPos.x;
      const dy = pos.y - drag.lastPos.y;
      if (
        Math.hypot(pos.x - drag.startPos.x, pos.y - drag.startPos.y) >
        DRAG_THRESHOLD
      )
        drag.moved = true;
      drag.lastPos = pos;
      const id = drag.id;
      if (drag.moved && selectedVertexId !== null && selectedVertexId !== id) {
        setSelectedVertexId(null);
      }
      setTerritories((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                x: clamp(t.x + dx / scaleX, 0, imgW),
                y: clamp(t.y + dy / scaleY, 0, imgH),
              }
            : t,
        ),
      );
    }
  }

  function tryDoubleTapReset(pos: Point, hitId: number | null): boolean {
    const near =
      Date.now() - lastTapAtRef.current < DOUBLE_TAP_MS &&
      Math.hypot(
        pos.x - lastTapPosRef.current.x,
        pos.y - lastTapPosRef.current.y,
      ) < DOUBLE_TAP_DIST;
    if (!near || (hitId !== null && hitId !== lastAddedVertexRef.current)) {
      return false;
    }
    lastTapAtRef.current = 0;
    const strayId = lastAddedVertexRef.current;
    lastAddedVertexRef.current = null;
    if (strayId !== null) {
      applyResort(territories.filter((t) => t.id !== strayId));
      setHoveredVertexId(null);
    }
    resetView();
    return true;
  }

  function endPointer(
    pos: Point,
    forced: WrapAxes = NO_WRAP,
    allowCrossover = false,
  ) {
    detachWindowDragListeners();
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (!drag) return;
    if (panOnlyRef.current) {
      startSettle();
      return;
    }
    const hitId = drag.type === 'vertex' ? drag.id : null;
    if (!drag.moved && tryDoubleTapReset(pos, hitId)) return;
    if (drag.type === 'pan') {
      if (!drag.moved) {
        lastTapPosRef.current = pos;
        lastTapAtRef.current = Date.now();
        if (selectedVertexId !== null) {
          setSelectedVertexId(null);
          lastAddedVertexRef.current = null;
        } else {
          lastAddedVertexRef.current = addVertexAt(pos);
        }
      }
      startSettle();
      return;
    }
    if (!drag.moved) {
      lastTapAtRef.current = 0;
      lastAddedVertexRef.current = null;
      handleVertexClick(drag.id, forced, allowCrossover);
      return;
    }
    applyResort(territories);
  }

  function cycleContinentAt(pos: Point) {
    const vertex = hitVertex(territories, getViewport(), pos);
    if (!vertex) {
      if (selectedVertexId !== null) {
        setSelectedVertexId(null);
        return;
      }
      setCurrentContinentId(
        nextInContinentCycle(currentContinentId, continentCount),
      );
      return;
    }
    const id = vertex.id;
    const current = vertex.isSea ? SEA_BRUSH : vertex.continentId;
    const next =
      brushContinentId === current
        ? nextInContinentCycle(current, continentCount)
        : brushContinentId;
    setCurrentContinentId(next);
    setTerritories((prev) =>
      prev.map((t) =>
        t.id === id
          ? next === SEA_BRUSH
            ? { ...t, isSea: true }
            : { ...t, continentId: next, isSea: false }
          : t,
      ),
    );
  }
  cycleContinentAtRef.current = cycleContinentAt;

  function handleMouseDown(e: React.MouseEvent) {
    if (disabledRef.current && e.button === 2 && paintCanvas) {
      eraseRef.current = [];
      erasePaint(getPos(e));
      return;
    }
    if (
      (disabledRef.current && !panOnlyRef.current) ||
      e.button !== 0 ||
      isSyntheticMouse()
    )
      return;
    beginPointer(getPos(e));
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (eraseRef.current) {
      erasePaint(getPos(e));
      return;
    }
    if ((disabledRef.current && !panOnlyRef.current) || isSyntheticMouse())
      return;
    const pos = getPos(e);
    if (panOnlyRef.current) {
      return;
    }
    syncForceWrap(e);
    const { scaleX, scaleY, offsetX, offsetY } = getViewport();
    setMouseWorldPos({
      x: (pos.x - offsetX) / scaleX,
      y: (pos.y - offsetY) / scaleY,
    });
    if (!dragRef.current) {
      setHoveredVertexId(
        hitVertex(territories, getViewport(), pos)?.id ?? null,
      );
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (eraseRef.current) {
      endErase();
      return;
    }
    if ((disabledRef.current && !panOnlyRef.current) || isSyntheticMouse())
      return;
    endPointer(getPos(e), wrapAxesOf(e), e.altKey);
  }

  function handleMouseLeave() {
    endErase();
    setHoveredVertexId(null);
    setMouseWorldPos(null);
    if (!dragRef.current) {
      setIsDragging(false);
      startSettle();
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (disabledRef.current || isSyntheticMouse()) return;
    cycleContinentAt(getPos(e));
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (disabledRef.current && !panOnlyRef.current) return;
    lastTouchAtRef.current = Date.now();
    clearLongPress();
    cancelSettle();
    if (e.touches.length === 1) {
      pinchRef.current = null;
      const pos = getPos(e.touches[0]);
      beginPointer(pos);
      if (!panOnlyRef.current) {
        longPressRef.current = window.setTimeout(() => {
          dragRef.current = null;
          setIsDragging(false);
          cycleContinentAtRef.current(pos);
          longPressRef.current = window.setInterval(() => {
            cycleContinentAtRef.current(pos);
          }, LONG_PRESS_REPEAT_MS);
        }, LONG_PRESS_MS);
      }
    } else if (e.touches.length === 2) {
      dragRef.current = null;
      setIsDragging(false);
      pinchRef.current = { lastDistance: touchDistance(e.touches) };
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (disabledRef.current && !panOnlyRef.current) return;
    lastTouchAtRef.current = Date.now();
    if (pinchRef.current && e.touches.length === 2) {
      clearLongPress();
      const distance = touchDistance(e.touches);
      const factor = distance / pinchRef.current.lastDistance;
      pinchRef.current.lastDistance = distance;
      const mid = touchMidpoint(e.touches);
      const rect = canvasRef.current!.getBoundingClientRect();
      applyZoom(
        { x: mid.clientX - rect.left, y: mid.clientY - rect.top },
        factor,
      );
      return;
    }
    if (dragRef.current && e.touches.length === 1) {
      const pos = getPos(e.touches[0]);
      const drag = dragRef.current;
      if (
        Math.hypot(pos.x - drag.startPos.x, pos.y - drag.startPos.y) >
        DRAG_THRESHOLD
      ) {
        clearLongPress();
      }
      dragPointer(pos);
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (disabledRef.current && !panOnlyRef.current) return;
    lastTouchAtRef.current = Date.now();
    clearLongPress();
    if (pinchRef.current) {
      if (e.touches.length === 0) pinchRef.current = null;
      return;
    }
    if (e.touches.length > 0) return;
    if (e.changedTouches.length > 0) {
      endPointer(getPos(e.changedTouches[0]));
    } else {
      dragRef.current = null;
      setIsDragging(false);
      startSettle();
    }
  }

  function handleTouchCancel() {
    lastTouchAtRef.current = Date.now();
    clearLongPress();
    dragRef.current = null;
    pinchRef.current = null;
    detachWindowDragListeners();
    setIsDragging(false);
    setHoveredVertexId(null);
    setMouseWorldPos(null);
    startSettle();
  }

  function attachWindowDragListeners() {
    window.addEventListener('mousemove', windowMouseMoveRef.current);
    window.addEventListener('mouseup', windowMouseUpRef.current);
  }

  function detachWindowDragListeners() {
    window.removeEventListener('mousemove', windowMouseMoveRef.current);
    window.removeEventListener('mouseup', windowMouseUpRef.current);
  }

  dragMoveHandlerRef.current = (e: MouseEvent) => {
    if (isSyntheticMouse()) return;
    dragPointer(getPos(e));
  };
  dragUpHandlerRef.current = (e: MouseEvent) => {
    if (isSyntheticMouse()) return;
    endPointer(getPos(e), wrapAxesOf(e), e.altKey);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{
        touchAction: 'none',
        display: 'block',
        width: size.w,
        height: size.h,
        cursor:
          hoveredVertexId !== null
            ? 'pointer'
            : isDragging
              ? 'grabbing'
              : 'grab',
      }}
    />
  );
});

export default memo(MapCanvas);
