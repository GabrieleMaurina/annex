import type {
  Dispatch,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { drawMapBorder, mapBorder } from '../../game/mapBorder';
import type { WrapAxes } from '../../game/mapMath';
import { playSound } from '../../lib/sounds';
import {
  canvasCursor,
  hitVertex,
  NO_WRAP,
  wrapAxesOf,
} from './canvas/canvasGeometry';
import { drawGraph } from './canvas/drawGraph';
import { drawPaintLayers, type PaintLayers } from './canvas/drawLayers';
import {
  pickAt,
  selectionAnchor,
  type GraphPick,
  type GraphSelection,
} from './canvas/graphPick';
import { useSmoothEdges } from './canvas/smoothEdges';
import { wireAt } from './canvas/switchWires';
import type { ClickableCheck } from './canvas/useClickableCheck';
import {
  handleVertexClick as linkVertices,
  type VertexLinkContext,
} from './canvas/vertexLink';
import { touchDistance, touchMidpoint, type Point } from './mapCanvasGeometry';
import {
  animateSettle,
  clamp,
  viewportFor,
  zoomTransform,
  type ViewTransform,
} from './mapViewport';
import {
  newTerritory,
  nextInContinentCycle,
  nextTerritoryId,
  SEA_BRUSH,
  SWITCH_BRUSH,
  withContinent,
  withoutVertex,
  type LinkMode,
  type EditorTerritory as Territory,
} from './model/editorTypes';
import { withSwitchToggled } from './model/switches';
import type { Viewport } from './paint/PaintLayer';
import { drawFreehand, paintContext, type Rect } from './paint/paintTools';

interface Props {
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentCount: number;
  imageSrc: string;
  currentContinentId: number;
  setCurrentContinentId: Dispatch<SetStateAction<number>>;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  paintCanvas: HTMLCanvasElement;
  paintSurfaceRef?: MutableRefObject<ImageData>;
  paintVersion?: number;
  paintSize?: number;
  onPaintChange?: () => void;
  onPaintStrokeEnd?: () => void;
  disabled?: boolean;
  panOnly?: boolean;
  hideImage?: boolean;
  hideGraph?: boolean;
  onViewport?: (v: Viewport) => void;
  clickable?: ClickableCheck | null;
  layers: PaintLayers;
  linkMode: LinkMode;
  onSelect: (id: number | null) => void;
  continentNames: string[];
  popover: (
    selection: GraphSelection,
    anchor: Point,
    close: () => void,
  ) => ReactNode;
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
  select: (id: number | null) => void;
  pickContinent: (id: number) => void;
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
    onViewport,
    clickable,
    layers,
    linkMode,
    onSelect,
    continentNames,
    popover,
  }: Props,
  ref,
) {
  const [smoothEdges] = useSmoothEdges();
  const brushContinentId = Math.min(currentContinentId, continentCount - 1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState>(null);
  const pinchRef = useRef<{ lastDistance: number } | null>(null);
  const settleRef = useRef<number | null>(null);
  const lastTouchAtRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const lastTapPosRef = useRef<Point>({ x: 0, y: 0 });
  const lastAddedVertexRef = useRef<number | null>(null);
  const lastVertexTapRef = useRef<{ id: number | null; at: number }>({
    id: null,
    at: 0,
  });
  const longPressRef = useRef<number | null>(null);
  const cycleContinentAtRef = useRef<(pos: Point) => void>(() => {});
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
  const [transform, setTransform] = useState<ViewTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [selectedVertexId, setSelectedVertexId] = useState<number | null>(null);
  const [pick, setPick] = useState<GraphPick>(null);
  useEffect(() => onSelect(selectedVertexId), [selectedVertexId, onSelect]);
  const [hoveredVertexId, setHoveredVertexId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point | null>(null);
  const [forceWrap, setForceWrap] = useState<WrapAxes>(NO_WRAP);
  const [allowCrossover, setAllowCrossover] = useState(false);
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
    if (disabled) clearSelection();
  }

  function clearSelection() {
    setSelectedVertexId(null);
    setPick(null);
  }

  function getImageDims(): { w: number; h: number } {
    return { w: paintCanvas.width, h: paintCanvas.height };
  }

  function getViewport() {
    const canvas = canvasRef.current!;
    const { w, h } = getImageDims();
    return viewportFor(
      canvas.clientWidth,
      canvas.clientHeight,
      w,
      h,
      transform,
    );
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
    const { w, h } = getImageDims();
    animateSettle(
      viewportFor(canvas.clientWidth, canvas.clientHeight, w, h, transform),
      { w: canvas.clientWidth, h: canvas.clientHeight },
      transform,
      setTransform,
      settleRef,
    );
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
      setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
      clearSelection();
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

  const syncModifiers = useCallback(
    (e: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) => {
      const next = wrapAxesOf(e);
      setForceWrap((prev) =>
        prev.x === next.x && prev.y === next.y ? prev : next,
      );
      setAllowCrossover(e.altKey);
    },
    [],
  );

  useEffect(() => {
    window.addEventListener('keydown', syncModifiers);
    window.addEventListener('keyup', syncModifiers);
    return () => {
      window.removeEventListener('keydown', syncModifiers);
      window.removeEventListener('keyup', syncModifiers);
    };
  }, [syncModifiers]);

  const deleteVertex = useCallback(
    (id: number) => {
      setTerritories(withoutVertex(territoriesRef.current, id));
      setSelectedVertexId(null);
      setHoveredVertexId((hovered) => (hovered === id ? null : hovered));
      if (lastAddedVertexRef.current === id) lastAddedVertexRef.current = null;
    },
    [setTerritories],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedVertexId !== null || pick) {
          playSound('click');
          clearSelection();
        } else if (!disabledRef.current && linkMode === 'select') {
          setCollapsed(true);
        }
        return;
      }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (selectedVertexId === null || e.target instanceof HTMLInputElement)
        return;
      e.preventDefault();
      playSound('click');
      deleteVertex(selectedVertexId);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVertexId, pick, linkMode, setCollapsed, deleteVertex]);

  const applyZoom = useCallback(
    (pos: Point, factor: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      cancelSettle();
      const canvasW = canvas.clientWidth;
      const canvasH = canvas.clientHeight;
      setTransform((prev) =>
        zoomTransform(
          prev,
          canvasW,
          canvasH,
          paintCanvas.width,
          paintCanvas.height,
          pos,
          factor,
        ),
      );
    },
    [cancelSettle, paintCanvas],
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
      select: setSelectedVertexId,
      pickContinent(id: number) {
        setSelectedVertexId(null);
        setPick({ kind: 'continent', id });
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

    ctx.fillStyle = '#10151c';
    ctx.fillRect(0, 0, size.w, size.h);

    const { zoom } = transform;
    const { w, h } = getImageDims();
    const viewport = viewportFor(size.w, size.h, w, h, transform);
    const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = viewport;

    onViewport?.({ offsetX, offsetY, scaleX, scaleY });

    drawMapBorder(
      ctx,
      paintSurfaceRef ? mapBorder(paintSurfaceRef.current) : null,
      offsetX,
      offsetY,
      imgW * scaleX,
      imgH * scaleY,
      10 * zoom,
    );

    drawPaintLayers(ctx, viewport, layers, {
      canvas: paintCanvas,
      version: paintVersion,
      hidden: hideImage,
      smooth: smoothEdges,
    });

    if (!hideGraph) {
      drawGraph({
        ctx,
        viewport,
        zoom,
        territories,
        rejectedEdge,
        selectedVertexId,
        hoveredVertexId,
        mouseWorldPos,
        dragging: dragRef.current !== null,
        forceWrap,
        allowCrossover,
        clickable,
        linkMode,
        pick,
        continentNames,
        brushId: brushContinentId,
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
    if (!points || !paintSurface) return;
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

  function addVertexAt(pos: Point): number | null {
    const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = getViewport();
    const worldX = (pos.x - offsetX) / scaleX;
    const worldY = (pos.y - offsetY) / scaleY;
    if (worldX < 0 || worldY < 0 || worldX > imgW || worldY > imgH) return null;
    if (linkMode !== 'normal' && linkMode !== 'switch') return null;
    const nextId = nextTerritoryId(territories);
    const brush = linkMode === 'switch' ? SWITCH_BRUSH : currentContinentId;
    setTerritories([
      ...territories,
      newTerritory(nextId, worldX, worldY, brush, continentCount),
    ]);
    setHoveredVertexId(nextId);
    return nextId;
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
      linkMode,
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
      setTerritories(territories.filter((t) => t.id !== strayId));
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
    if (!drag.moved) playSound('click');
    if (!drag.moved && tryDoubleTapReset(pos, hitId)) return;
    if (drag.type === 'pan') {
      if (!drag.moved) {
        lastTapPosRef.current = pos;
        lastTapAtRef.current = Date.now();
        lastAddedVertexRef.current = null;
        const wired = wireAt(
          territories,
          selectedVertexId,
          linkMode,
          getViewport(),
          pos,
        );
        const picked = !wired && pickAt(territories, getViewport(), pos);
        if (wired) setTerritories(wired);
        else if (picked) {
          setSelectedVertexId(null);
          setPick(picked);
        } else if (selectedVertexId !== null || pick) {
          clearSelection();
        } else {
          lastAddedVertexRef.current = addVertexAt(pos);
        }
      }
      startSettle();
      return;
    }
    if (!drag.moved) {
      const now = Date.now();
      const lastVertexTap = lastVertexTapRef.current;
      const isDoubleTap =
        lastVertexTap.id === drag.id && now - lastVertexTap.at < DOUBLE_TAP_MS;
      lastVertexTapRef.current = isDoubleTap
        ? { id: null, at: 0 }
        : { id: drag.id, at: now };
      lastTapAtRef.current = 0;
      lastAddedVertexRef.current = null;
      if (isDoubleTap) deleteVertex(drag.id);
      else handleVertexClick(drag.id, forced, allowCrossover);
      setPick(null);
    }
  }

  function cycleContinentAt(pos: Point) {
    playSound('click');
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
    if (vertex.switch) {
      setTerritories((prev) => withSwitchToggled(prev, id));
      return;
    }
    const current = vertex.isSea ? SEA_BRUSH : vertex.continentId;
    const next =
      brushContinentId === current
        ? nextInContinentCycle(current, continentCount)
        : brushContinentId;
    setCurrentContinentId(next);
    setTerritories((prev) => withContinent(prev, id, next));
  }
  cycleContinentAtRef.current = cycleContinentAt;

  function handleMouseDown(e: React.MouseEvent) {
    if (disabledRef.current && e.button === 2) {
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
    syncModifiers(e);
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

  const selection: GraphSelection | null =
    selectedVertexId !== null ? { kind: 'vertex', id: selectedVertexId } : pick;
  const anchor =
    selection &&
    !hideGraph &&
    (selection.kind !== 'vertex' || linkMode === 'select') &&
    selectionAnchor(
      selection,
      territories,
      continentNames,
      viewportFor(
        size.w,
        size.h,
        paintCanvas.width,
        paintCanvas.height,
        transform,
      ),
    );

  return (
    <>
      {selection && anchor && popover(selection, anchor, clearSelection)}
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
          cursor: canvasCursor(hoveredVertexId !== null, isDragging),
        }}
      />
    </>
  );
});

export default memo(MapCanvas);
