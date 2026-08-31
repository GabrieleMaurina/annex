import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Territory } from '../types';
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
} from '../utils/defaultImage';
import { continentColor } from '../utils/palette';
import {
  clamp,
  clampPan,
  createSettleSampler,
  easeOutCubic,
  MAX_ZOOM,
  MIN_ZOOM,
  screenOffset,
} from './mapViewport';

interface Props {
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentCount: number;
  imageSrc: string;
  currentContinentId: number;
  setCurrentContinentId: Dispatch<SetStateAction<number>>;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
}

interface Point {
  x: number;
  y: number;
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

const VERTEX_DIAMETERS_PER_LONGEST_SIDE = 50;
const HIT_TOLERANCE = 6;
const HIT_RADIUS_MULTIPLIER = 2;
const DRAG_THRESHOLD = 4;
const SETTLE_DURATION = 200;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 24;

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function segmentsProperlyIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): boolean {
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t =
    lenSq === 0
      ? 0
      : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq, 0, 1);
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function wrapSplitX(a: Point, b: Point, mapW: number): [Point, Point][] {
  const d = b.x - a.x;
  if (Math.abs(d) <= mapW / 2) return [[a, b]];
  const sign = Math.sign(d);
  const bx = b.x - sign * mapW;
  const boundary = sign < 0 ? mapW : 0;
  const t = (boundary - a.x) / (bx - a.x);
  const y = a.y + t * (b.y - a.y);
  return [
    [a, { x: boundary, y }],
    [{ x: mapW - boundary, y }, b],
  ];
}

function wrapSplitY(a: Point, b: Point, mapH: number): [Point, Point][] {
  const d = b.y - a.y;
  if (Math.abs(d) <= mapH / 2) return [[a, b]];
  const sign = Math.sign(d);
  const by = b.y - sign * mapH;
  const boundary = sign < 0 ? mapH : 0;
  const t = (boundary - a.y) / (by - a.y);
  const x = a.x + t * (b.x - a.x);
  return [
    [a, { x, y: boundary }],
    [{ x, y: mapH - boundary }, b],
  ];
}

function wrapEdgeSegments(
  a: Point,
  b: Point,
  mapW: number,
  mapH: number,
): [Point, Point][] {
  const segments: [Point, Point][] = [];
  for (const [p1, p2] of wrapSplitX(a, b, mapW)) {
    segments.push(...wrapSplitY(p1, p2, mapH));
  }
  return segments;
}

const SYNTHETIC_MOUSE_WINDOW_MS = 500;
const LONG_PRESS_MS = 500;

function touchDistance(touches: React.TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
}

function touchMidpoint(touches: React.TouchList): {
  clientX: number;
  clientY: number;
} {
  return {
    clientX: (touches[0].clientX + touches[1].clientX) / 2,
    clientY: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function MapCanvas({
  territories,
  setTerritories,
  continentCount,
  imageSrc,
  currentContinentId,
  setCurrentContinentId,
  setCollapsed,
}: Props) {
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
  const [transform, setTransform] = useState<Transform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [selectedVertexId, setSelectedVertexId] = useState<number | null>(null);
  const [hoveredVertexId, setHoveredVertexId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point | null>(null);
  const [rejectedEdge, setRejectedEdge] = useState<[Point, Point][] | null>(
    null,
  );
  const rejectedTimeoutRef = useRef<number | null>(null);
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  function getImageDims(): { w: number; h: number } {
    const img = imageRef.current;
    return img
      ? { w: img.naturalWidth, h: img.naturalHeight }
      : { w: DEFAULT_IMAGE_WIDTH, h: DEFAULT_IMAGE_HEIGHT };
  }

  function getVertexRadius(imgW: number, imgH: number): number {
    return Math.max(imgW, imgH) / (VERTEX_DIAMETERS_PER_LONGEST_SIDE * 2);
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

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
    };
    img.src = imageSrc;
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

  useEffect(() => {
    document.addEventListener('fullscreenchange', resetView);
    return () => document.removeEventListener('fullscreenchange', resetView);
  }, [resetView]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedVertexId !== null) {
          setSelectedVertexId(null);
        } else {
          setCollapsed(true);
        }
        return;
      }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (selectedVertexId === null) return;
      e.preventDefault();
      const id = selectedVertexId;
      setTerritories((prev) =>
        prev
          .filter((t) => t.id !== id)
          .map((t) => ({
            ...t,
            neighbors: t.neighbors.filter((n) => n !== id),
          })),
      );
      setSelectedVertexId(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVertexId, setTerritories, setCollapsed]);

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
      const baseScale = Math.min(canvasW / imgW, canvasH / imgH);
      setTransform((prev) => {
        const oldScale = baseScale * prev.zoom;
        const oldOffX = (canvasW - imgW * oldScale) / 2 + prev.offsetX;
        const oldOffY = (canvasH - imgH * oldScale) / 2 + prev.offsetY;
        const worldX = (pos.x - oldOffX) / oldScale;
        const worldY = (pos.y - oldOffY) / oldScale;
        const newZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const newScale = baseScale * newZoom;
        const { x, y } = clampPan(
          canvasW,
          canvasH,
          newScale,
          newScale,
          imgW,
          imgH,
          pos.x - worldX * newScale - (canvasW - imgW * newScale) / 2,
          pos.y - worldY * newScale - (canvasH - imgH * newScale) / 2,
        );
        return { zoom: newZoom, offsetX: x, offsetY: y };
      });
    },
    [cancelSettle],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
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

    if (imageRef.current) {
      ctx.drawImage(
        imageRef.current,
        offsetX,
        offsetY,
        imgW * scaleX,
        imgH * scaleY,
      );
    }

    const toScreen = (p: Point): Point => ({
      x: p.x * scaleX + offsetX,
      y: p.y * scaleY + offsetY,
    });
    const byId = new Map(territories.map((t) => [t.id, t]));

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2 * zoom;
    const drawnEdges = new Set<string>();
    for (const t of territories) {
      for (const n of t.neighbors) {
        const key = edgeKey(t.id, n);
        if (drawnEdges.has(key)) continue;
        drawnEdges.add(key);
        const other = byId.get(n);
        if (!other) continue;
        for (const [a, b] of wrapEdgeSegments(t, other, imgW, imgH)) {
          const p1 = toScreen(a);
          const p2 = toScreen(b);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    if (rejectedEdge) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3 * zoom;
      for (const [a, b] of rejectedEdge) {
        const p1 = toScreen(a);
        const p2 = toScreen(b);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    if (
      selectedVertexId !== null &&
      mouseWorldPos !== null &&
      !dragRef.current
    ) {
      const fromTerritory = byId.get(selectedVertexId);
      if (fromTerritory) {
        const excludeIds = new Set<number>([selectedVertexId]);
        if (hoveredVertexId !== null) excludeIds.add(hoveredVertexId);
        const overlapping = segmentWouldCross(
          fromTerritory,
          mouseWorldPos,
          excludeIds,
        );
        ctx.strokeStyle = overlapping ? '#ff0000' : '#000000';
        ctx.lineWidth = 2 * zoom;
        for (const [a, b] of wrapEdgeSegments(
          fromTerritory,
          mouseWorldPos,
          imgW,
          imgH,
        )) {
          const p1 = toScreen(a);
          const p2 = toScreen(b);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    const vertexRadius = getVertexRadius(imgW, imgH);
    for (const t of territories) {
      const p = toScreen(t);
      const isSelected = selectedVertexId === t.id;
      const isHovered = hoveredVertexId === t.id;
      ctx.beginPath();
      ctx.arc(p.x, p.y, vertexRadius * scaleX, 0, Math.PI * 2);
      ctx.fillStyle = continentColor(t.continentId);
      ctx.fill();
      ctx.strokeStyle = isSelected
        ? '#bbbbbb'
        : isHovered
          ? '#555555'
          : '#000000';
      ctx.lineWidth = (isSelected || isHovered ? 7 : 2) * zoom;
      ctx.stroke();
    }
  });

  function getPos(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitVertex(pos: Point): Territory | null {
    const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = getViewport();
    const hitRadius =
      getVertexRadius(imgW, imgH) * HIT_RADIUS_MULTIPLIER * scaleX +
      HIT_TOLERANCE;
    let nearest: Territory | null = null;
    let nearestDist = Infinity;
    for (const t of territories) {
      const d = Math.hypot(
        pos.x - (t.x * scaleX + offsetX),
        pos.y - (t.y * scaleY + offsetY),
      );
      if (d <= hitRadius && d < nearestDist) {
        nearest = t;
        nearestDist = d;
      }
    }
    return nearest;
  }

  function addVertexAt(pos: Point): number {
    const { scaleX, scaleY, offsetX, offsetY } = getViewport();
    const worldX = (pos.x - offsetX) / scaleX;
    const worldY = (pos.y - offsetY) / scaleY;
    const nextId = territories.length
      ? Math.max(...territories.map((t) => t.id)) + 1
      : 0;
    setTerritories((prev) => [
      ...prev,
      {
        id: nextId,
        continentId: currentContinentId % continentCount,
        x: worldX,
        y: worldY,
        neighbors: [],
      },
    ]);
    setHoveredVertexId(nextId);
    return nextId;
  }

  function segmentWouldCross(
    from: Point,
    to: Point,
    excludeIds: Set<number>,
  ): boolean {
    const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = getViewport();
    const toScreenPos = (p: Point): Point => ({
      x: p.x * scaleX + offsetX,
      y: p.y * scaleY + offsetY,
    });
    const toScreenSegments = (a: Point, b: Point): [Point, Point][] =>
      wrapEdgeSegments(a, b, imgW, imgH).map(
        ([p1, p2]) => [toScreenPos(p1), toScreenPos(p2)] as [Point, Point],
      );
    const candidateSegments = toScreenSegments(from, to);
    const radius = getVertexRadius(imgW, imgH) * scaleX;
    const byId = new Map(territories.map((t) => [t.id, t]));

    for (const v of territories) {
      if (excludeIds.has(v.id)) continue;
      const vScreen = toScreenPos(v);
      for (const [p1, p2] of candidateSegments) {
        if (pointToSegmentDistance(vScreen, p1, p2) < radius) return true;
      }
    }

    const seen = new Set<string>();
    for (const t of territories) {
      for (const n of t.neighbors) {
        if (excludeIds.has(t.id) || excludeIds.has(n)) continue;
        const key = edgeKey(t.id, n);
        if (seen.has(key)) continue;
        seen.add(key);
        const other = byId.get(n);
        if (!other) continue;
        const existingSegments = toScreenSegments(t, other);
        for (const [c1, c2] of candidateSegments) {
          for (const [e1, e2] of existingSegments) {
            if (segmentsProperlyIntersect(c1, c2, e1, e2)) return true;
          }
        }
      }
    }
    return false;
  }

  function edgeWouldCross(from: Territory, to: Territory): boolean {
    return segmentWouldCross(from, to, new Set([from.id, to.id]));
  }

  function flashRejectedEdge(from: Territory, to: Territory) {
    const { w: imgW, h: imgH } = getImageDims();
    setRejectedEdge(wrapEdgeSegments(from, to, imgW, imgH));
    if (rejectedTimeoutRef.current !== null) {
      window.clearTimeout(rejectedTimeoutRef.current);
    }
    rejectedTimeoutRef.current = window.setTimeout(
      () => setRejectedEdge(null),
      300,
    );
  }

  function handleVertexClick(id: number) {
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
      fromTerritory &&
      toTerritory &&
      edgeWouldCross(fromTerritory, toTerritory)
    ) {
      flashRejectedEdge(fromTerritory, toTerritory);
      setSelectedVertexId(id);
      return;
    }
    setTerritories((ts) =>
      ts.map((t) => {
        if (t.id === from) {
          return {
            ...t,
            neighbors: linked
              ? t.neighbors.filter((n) => n !== id)
              : [...t.neighbors, id],
          };
        }
        if (t.id === id) {
          return {
            ...t,
            neighbors: linked
              ? t.neighbors.filter((n) => n !== from)
              : [...t.neighbors, from],
          };
        }
        return t;
      }),
    );
    setSelectedVertexId(id);
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
    const vertex = hitVertex(pos);
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
      const { scaleX, scaleY } = getViewport();
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
            ? { ...t, x: t.x + dx / scaleX, y: t.y + dy / scaleY }
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
      setTerritories((prev) => prev.filter((t) => t.id !== strayId));
      setHoveredVertexId(null);
    }
    resetView();
    return true;
  }

  function endPointer(pos: Point) {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (!drag) return;
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
      handleVertexClick(drag.id);
    }
  }

  function cycleContinentAt(pos: Point) {
    const vertex = hitVertex(pos);
    if (!vertex) {
      if (selectedVertexId !== null) {
        setSelectedVertexId(null);
        return;
      }
      setCurrentContinentId((currentContinentId + 1) % continentCount);
      return;
    }
    const nextContinentId = (vertex.continentId + 1) % continentCount;
    setCurrentContinentId(nextContinentId);
    const id = vertex.id;
    setTerritories((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, continentId: nextContinentId } : t,
      ),
    );
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || isSyntheticMouse()) return;
    beginPointer(getPos(e));
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isSyntheticMouse()) return;
    const pos = getPos(e);
    const { scaleX, scaleY, offsetX, offsetY } = getViewport();
    setMouseWorldPos({
      x: (pos.x - offsetX) / scaleX,
      y: (pos.y - offsetY) / scaleY,
    });
    if (!dragRef.current) {
      setHoveredVertexId(hitVertex(pos)?.id ?? null);
      return;
    }
    dragPointer(pos);
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (isSyntheticMouse()) return;
    endPointer(getPos(e));
  }

  function handleMouseLeave() {
    dragRef.current = null;
    setHoveredVertexId(null);
    setMouseWorldPos(null);
    setIsDragging(false);
    startSettle();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (isSyntheticMouse()) return;
    cycleContinentAt(getPos(e));
  }

  function handleTouchStart(e: React.TouchEvent) {
    lastTouchAtRef.current = Date.now();
    clearLongPress();
    cancelSettle();
    if (e.touches.length === 1) {
      pinchRef.current = null;
      const pos = getPos(e.touches[0]);
      beginPointer(pos);
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        dragRef.current = null;
        setIsDragging(false);
        cycleContinentAt(pos);
      }, LONG_PRESS_MS);
    } else if (e.touches.length === 2) {
      dragRef.current = null;
      setIsDragging(false);
      pinchRef.current = { lastDistance: touchDistance(e.touches) };
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
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
    setIsDragging(false);
    setHoveredVertexId(null);
    setMouseWorldPos(null);
    startSettle();
  }

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
}

export default MapCanvas;
