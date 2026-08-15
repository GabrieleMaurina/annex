import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_IMAGE_HEIGHT, DEFAULT_IMAGE_WIDTH } from './defaultImage';
import { continentColor } from './palette';
import type { Territory } from './types';

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

const VERTEX_RADIUS = 15;
const HIT_TOLERANCE = 6;
const DRAG_THRESHOLD = 4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  const [transform, setTransform] = useState<Transform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [selectedVertexId, setSelectedVertexId] = useState<number | null>(null);
  const [hoveredVertexId, setHoveredVertexId] = useState<number | null>(null);
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

  function getScales(canvasW: number, canvasH: number, zoom: number) {
    const { w: imgW, h: imgH } = getImageDims();
    return {
      imgW,
      imgH,
      scaleX: (canvasW / imgW) * zoom,
      scaleY: (canvasH / imgH) * zoom,
    };
  }

  function clampOffset(
    canvasW: number,
    canvasH: number,
    scaleX: number,
    scaleY: number,
    imgW: number,
    imgH: number,
    x: number,
    y: number,
  ) {
    return {
      x: clamp(x, canvasW - imgW * scaleX, 0),
      y: clamp(y, canvasH - imgH * scaleY, 0),
    };
  }

  function getClampedOffset(
    canvasW: number,
    canvasH: number,
    zoom: number,
    x: number,
    y: number,
  ) {
    const { imgW, imgH, scaleX, scaleY } = getScales(canvasW, canvasH, zoom);
    return clampOffset(canvasW, canvasH, scaleX, scaleY, imgW, imgH, x, y);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const canvasW = canvas!.clientWidth;
      const canvasH = canvas!.clientHeight;
      const { w: imgW, h: imgH } = getImageDims();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setTransform((prev) => {
        const oldScaleX = (canvasW / imgW) * prev.zoom;
        const oldScaleY = (canvasH / imgH) * prev.zoom;
        const worldX = (pos.x - prev.offsetX) / oldScaleX;
        const worldY = (pos.y - prev.offsetY) / oldScaleY;
        const newZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const newScaleX = (canvasW / imgW) * newZoom;
        const newScaleY = (canvasH / imgH) * newZoom;
        const { x, y } = clampOffset(
          canvasW,
          canvasH,
          newScaleX,
          newScaleY,
          imgW,
          imgH,
          pos.x - worldX * newScaleX,
          pos.y - worldY * newScaleY,
        );
        return { zoom: newZoom, offsetX: x, offsetY: y };
      });
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size.w, size.h);

    const { zoom } = transform;
    const { imgW, imgH, scaleX, scaleY } = getScales(size.w, size.h, zoom);
    const { x: offsetX, y: offsetY } = getClampedOffset(
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

    const toScreen = (t: Territory): Point => ({
      x: t.x * scaleX + offsetX,
      y: t.y * scaleY + offsetY,
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
        const p1 = toScreen(t);
        const p2 = toScreen(other);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    for (const t of territories) {
      const p = toScreen(t);
      const isSelected = selectedVertexId === t.id;
      const isHovered = hoveredVertexId === t.id;
      ctx.beginPath();
      ctx.arc(p.x, p.y, VERTEX_RADIUS * zoom, 0, Math.PI * 2);
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
    const canvas = canvasRef.current!;
    const { scaleX, scaleY } = getScales(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
    );
    const { x: offsetX, y: offsetY } = getClampedOffset(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
    for (let i = territories.length - 1; i >= 0; i--) {
      const t = territories[i];
      const d = Math.hypot(
        pos.x - (t.x * scaleX + offsetX),
        pos.y - (t.y * scaleY + offsetY),
      );
      if (d <= VERTEX_RADIUS * transform.zoom + HIT_TOLERANCE) return t;
    }
    return null;
  }

  function addVertexAt(pos: Point) {
    const canvas = canvasRef.current!;
    const { scaleX, scaleY } = getScales(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
    );
    const { x: offsetX, y: offsetY } = getClampedOffset(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
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
    setTerritories((ts) => {
      const fromTerritory = ts.find((t) => t.id === from);
      const linked = fromTerritory
        ? fromTerritory.neighbors.includes(id)
        : false;
      return ts.map((t) => {
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
      });
    });
    setSelectedVertexId(id);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const pos = getPos(e);
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
    const canvas = canvasRef.current!;
    const { x, y } = getClampedOffset(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
    dragRef.current = {
      type: 'pan',
      startPos: pos,
      startTransform: { x, y },
      moved: false,
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    const pos = getPos(e);
    if (!drag) {
      setHoveredVertexId(hitVertex(pos)?.id ?? null);
      return;
    }
    if (drag.type === 'pan') {
      const dx = pos.x - drag.startPos.x;
      const dy = pos.y - drag.startPos.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
      if (drag.moved) {
        const canvas = canvasRef.current!;
        const { imgW, imgH, scaleX, scaleY } = getScales(
          canvas.clientWidth,
          canvas.clientHeight,
          transform.zoom,
        );
        const { x, y } = clampOffset(
          canvas.clientWidth,
          canvas.clientHeight,
          scaleX,
          scaleY,
          imgW,
          imgH,
          drag.startTransform.x + dx,
          drag.startTransform.y + dy,
        );
        setTransform((t) => ({ ...t, offsetX: x, offsetY: y }));
      }
    } else {
      const dx = pos.x - drag.lastPos.x;
      const dy = pos.y - drag.lastPos.y;
      if (
        Math.hypot(pos.x - drag.startPos.x, pos.y - drag.startPos.y) >
        DRAG_THRESHOLD
      )
        drag.moved = true;
      drag.lastPos = pos;
      const id = drag.id;
      const canvas = canvasRef.current!;
      const { scaleX, scaleY } = getScales(
        canvas.clientWidth,
        canvas.clientHeight,
        transform.zoom,
      );
      setTerritories((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, x: t.x + dx / scaleX, y: t.y + dy / scaleY }
            : t,
        ),
      );
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const pos = getPos(e);
    if (drag.type === 'pan') {
      if (!drag.moved) {
        if (selectedVertexId !== null) {
          setSelectedVertexId(null);
        } else {
          addVertexAt(pos);
        }
      }
      return;
    }
    if (!drag.moved) handleVertexClick(drag.id);
  }

  function handleMouseLeave() {
    dragRef.current = null;
    setHoveredVertexId(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const pos = getPos(e);
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

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      style={{
        display: 'block',
        width: size.w,
        height: size.h,
        cursor: hoveredVertexId !== null ? 'pointer' : 'default',
      }}
    />
  );
}

export default MapCanvas;
