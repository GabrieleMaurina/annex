import type { WrapAxes } from '../../../game/mapMath';
import { contrastTextColor } from '../../../lib/palette';
import { edgeKey, wrapEdgeSegments, type Point } from '../mapCanvasGeometry';
import { borderScale } from '../mapViewport';
import type { EditorTerritory as Territory } from '../model/editorTypes';
import { continentColor, SEA_MARKER_COLOR } from '../palette';
import {
  getVertexRadius,
  SEA_SIZE_MULTIPLIER,
  segmentWouldCross,
  wrapOf,
  type Viewport,
} from './canvasGeometry';

interface DrawGraphParams {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  zoom: number;
  territories: Territory[];
  rejectedEdge: [Point, Point][] | null;
  selectedVertexId: number | null;
  hoveredVertexId: number | null;
  mouseWorldPos: Point | null;
  dragging: boolean;
  forceWrap: WrapAxes;
  allowCrossover: boolean;
}

function hexagonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawGraph({
  ctx,
  viewport,
  zoom,
  territories,
  rejectedEdge,
  selectedVertexId,
  hoveredVertexId,
  mouseWorldPos,
  dragging,
  forceWrap,
  allowCrossover,
}: DrawGraphParams) {
  const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = viewport;
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
      for (const [a, b] of wrapEdgeSegments(
        t,
        other,
        imgW,
        imgH,
        wrapOf(t, n),
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

  if (selectedVertexId !== null && mouseWorldPos !== null && !dragging) {
    const fromTerritory = byId.get(selectedVertexId);
    if (fromTerritory) {
      const excludeIds = new Set<number>([selectedVertexId]);
      if (hoveredVertexId !== null) excludeIds.add(hoveredVertexId);
      const overlapping =
        !allowCrossover &&
        segmentWouldCross(
          territories,
          viewport,
          fromTerritory,
          mouseWorldPos,
          excludeIds,
          forceWrap,
        );
      ctx.strokeStyle = overlapping ? '#ff0000' : '#000000';
      ctx.lineWidth = 2 * zoom;
      for (const [a, b] of wrapEdgeSegments(
        fromTerritory,
        mouseWorldPos,
        imgW,
        imgH,
        forceWrap,
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
  const vertexBorderScale = borderScale((vertexRadius * scaleX) / zoom);
  for (const t of territories) {
    const p = toScreen(t);
    const isSelected = selectedVertexId === t.id;
    const isHovered = hoveredVertexId === t.id;
    ctx.beginPath();
    if (t.isSea) {
      hexagonPath(ctx, p.x, p.y, vertexRadius * scaleX * SEA_SIZE_MULTIPLIER);
      ctx.fillStyle = SEA_MARKER_COLOR;
    } else {
      ctx.arc(p.x, p.y, vertexRadius * scaleX, 0, Math.PI * 2);
      ctx.fillStyle = continentColor(t.continentId);
    }
    ctx.fill();
    ctx.strokeStyle = isSelected
      ? '#bbbbbb'
      : isHovered
        ? '#555555'
        : '#000000';
    ctx.lineWidth =
      (isSelected || isHovered ? 7 : 2) * zoom * vertexBorderScale;
    ctx.stroke();

    const labelRadius = t.isSea
      ? vertexRadius * scaleX * SEA_SIZE_MULTIPLIER
      : vertexRadius * scaleX;
    ctx.fillStyle = contrastTextColor(
      t.isSea ? SEA_MARKER_COLOR : continentColor(t.continentId),
    );
    ctx.font = `bold ${labelRadius}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const text = String(t.id + 1);
    const metrics = ctx.measureText(text);
    const baselineY =
      p.y +
      (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    ctx.fillText(text, p.x, baselineY);
  }
}
