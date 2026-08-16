import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { loadGameMap, type Territory } from './mapData';
import { continentColor, contrastTextColor, playerColor } from './palette';
import PlayersPanel from './PlayersPanel';
import type { GameState } from './types';

interface Props {
  mapName: string;
  players: GameState['players'];
  spectators: GameState['spectators'];
  ownership: GameState['territories'];
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  navigate: (path: string) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
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

type DragState = {
  startPos: Point;
  startTransform: Point;
  moved: boolean;
} | null;

const VERTEX_RADIUS = 15;
const HIT_TOLERANCE = 6;
const DRAG_THRESHOLD = 4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

const STATE_STYLE = {
  normal: { stroke: '#000000', width: 2 },
  selectable: { stroke: '#888888', width: 7 },
  hovered: { stroke: '#bbbbbb', width: 7 },
  selected: { stroke: '#ffffff', width: 7 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function GameMap({
  mapName,
  players,
  spectators,
  ownership,
  setChatOpen,
  navigate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [transform, setTransform] = useState<Transform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    loadGameMap(mapName).then(({ territories, imageSrc }) => {
      setTerritories(territories);
      setSelectedId(null);
      setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
      if (!imageSrc) {
        imageRef.current = null;
        return;
      }
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
      };
      img.src = imageSrc;
    });
  }, [mapName]);

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
        if (selectedId !== null) {
          setSelectedId(null);
          return;
        }
        setPanelCollapsed(true);
        setChatOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        setPanelCollapsed((prev) => !prev);
      } else if (e.key.toLowerCase() === 't') {
        setChatOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, setChatOpen]);

  function getImageDims(): { w: number; h: number } {
    const img = imageRef.current;
    return img ? { w: img.naturalWidth, h: img.naturalHeight } : { w: 1, h: 1 };
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

  function nodeState(
    id: number,
  ): 'normal' | 'selectable' | 'hovered' | 'selected' {
    if (id === selectedId) return 'selected';
    if (id === hoveredId) return 'hovered';
    if (selectedId !== null) {
      const selected = territories.find((t) => t.id === selectedId);
      if (selected?.neighbors.includes(id)) return 'selectable';
    }
    return 'normal';
  }

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

    const toScreen = (p: Point): Point => ({
      x: p.x * scaleX + offsetX,
      y: p.y * scaleY + offsetY,
    });

    const ownerById = new Map(ownership.map((o) => [o.id, o]));
    const colorByPlayerId = new Map(players.map((pl) => [pl.id, pl.color]));

    for (const t of territories) {
      const p = toScreen(t);
      const style = STATE_STYLE[nodeState(t.id)];
      const owner = ownerById.get(t.id);
      const fillColor = owner
        ? playerColor(colorByPlayerId.get(owner.ownerId) ?? 0)
        : continentColor(t.continentId);
      ctx.beginPath();
      ctx.arc(p.x, p.y, VERTEX_RADIUS * zoom, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.width * zoom;
      ctx.stroke();

      if (owner) {
        ctx.fillStyle = contrastTextColor(fillColor);
        ctx.font = `bold ${VERTEX_RADIUS * zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(owner.troops), p.x, p.y);
      }
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

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const { x, y } = getClampedOffset(
      canvas.clientWidth,
      canvas.clientHeight,
      transform.zoom,
      transform.offsetX,
      transform.offsetY,
    );
    dragRef.current = { startPos: pos, startTransform: { x, y }, moved: false };
  }

  function handleMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    const pos = getPos(e);
    if (!drag) {
      setHoveredId(hitVertex(pos)?.id ?? null);
      return;
    }
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
      setHoveredId(null);
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;
    const pos = getPos(e);
    const vertex = hitVertex(pos);
    if (!vertex) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev === vertex.id ? null : vertex.id));
  }

  function handleMouseLeave() {
    dragRef.current = null;
    setHoveredId(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setSelectedId(null);
  }

  return (
    <div className="position-relative">
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
          cursor: hoveredId !== null ? 'pointer' : 'default',
        }}
      />
      <PlayersPanel
        players={players}
        spectators={spectators}
        collapsed={panelCollapsed}
        setCollapsed={setPanelCollapsed}
        navigate={navigate}
      />
    </div>
  );
}

export default GameMap;
