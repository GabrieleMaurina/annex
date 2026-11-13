import { drawTerritoryNames } from '../../../game/GameMap/draw/drawNames';
import { drawSwitchIcon } from '../../../game/GameMap/draw/drawSwitches';
import { CANVAS_FONT_FAMILY } from '../../../game/GameMap/helpers';
import type { PlaceNames } from '../../../game/mapData';
import type { WrapAxes } from '../../../game/mapMath';
import { SWITCH_WIDTH_RADII } from '../../../game/switches/switches';
import { contrastTextColor } from '../../../lib/palette';
import { edgeKey, wrapEdgeSegments, type Point } from '../mapCanvasGeometry';
import { borderScale } from '../mapViewport';
import {
  SEA_BRUSH,
  type LinkMode,
  type EditorTerritory as Territory,
} from '../model/editorTypes';
import { switchLabels } from '../model/switches';
import {
  continentColor,
  LOCKED_MARKER_COLOR,
  SEA_MARKER_COLOR,
} from '../palette';
import {
  getVertexRadius,
  NO_WRAP,
  SEA_SIZE_MULTIPLIER,
  segmentWouldCross,
  wrapOf,
  type Viewport,
} from './canvasGeometry';
import {
  continentLabels,
  labelBox,
  labelFontSize,
  linkMidpoint,
  linkSegments,
  pickAt,
  type GraphPick,
} from './graphPick';
import type { ClickableCheck } from './useClickableCheck';

const LOCKED_DASH = 0.35;
const WIRE_COLOR = '#ffd43b';
const PICK_COLOR = '#ffffff';
const PICK_LINK_COLOR = '#0dcaf0';

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
  clickable?: ClickableCheck | null;
  linkMode: LinkMode;
  pick: GraphPick;
  continentNames: string[];
  brushId: number;
}

const GHOST_ALPHA = 0.5;
const GHOST_ICON_RATIO = 1.4;
const TOOL_ICONS: Partial<Record<LinkMode, HTMLImageElement>> = {
  timed: iconImage('/icons/stopwatch.svg'),
  directional: iconImage('/icons/directional.svg'),
};

function iconImage(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

const placeNamesCache = new WeakMap<Territory[], PlaceNames>();

function editorPlaceNames(territories: Territory[]): PlaceNames {
  const cached = placeNamesCache.get(territories);
  if (cached) return cached;
  const names = {
    territories: new Map(
      territories
        .filter((t) => t.name.trim())
        .map((t) => [t.id, t.name.trim()]),
    ),
    continents: new Map<number, string>(),
  };
  placeNamesCache.set(territories, names);
  return names;
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  from: Point,
  tip: Point,
  inset: number,
  size: number,
): void {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= inset) return;
  const ux = dx / length;
  const uy = dy / length;
  const x = tip.x - ux * inset;
  const y = tip.y - uy * inset;
  ctx.beginPath();
  ctx.moveTo(x - ux * size - uy * size, y - uy * size + ux * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - ux * size + uy * size, y - uy * size - ux * size);
  ctx.stroke();
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

function drawGhost(
  ctx: CanvasRenderingContext2D,
  p: Point,
  radius: number,
  scale: number,
  linkMode: LinkMode,
  brushId: number,
) {
  ctx.save();
  ctx.globalAlpha = GHOST_ALPHA;
  if (linkMode === 'switch') {
    drawSwitchIcon(ctx, p, SWITCH_WIDTH_RADII * radius, 0, scale);
    ctx.restore();
    return;
  }
  const icon = TOOL_ICONS[linkMode];
  const isSea = brushId === SEA_BRUSH;
  ctx.beginPath();
  if (isSea) hexagonPath(ctx, p.x, p.y, radius * SEA_SIZE_MULTIPLIER);
  else ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = icon
    ? '#ffffff'
    : isSea
      ? SEA_MARKER_COLOR
      : continentColor(brushId);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  if (icon?.complete && icon.naturalWidth > 0) {
    const size = radius * GHOST_ICON_RATIO;
    ctx.drawImage(icon, p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.restore();
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
  clickable,
  linkMode,
  pick,
  continentNames,
  brushId,
}: DrawGraphParams) {
  const { imgW, imgH, scaleX, scaleY, offsetX, offsetY } = viewport;
  const toScreen = (p: Point): Point => ({
    x: p.x * scaleX + offsetX,
    y: p.y * scaleY + offsetY,
  });
  const byId = new Map(territories.map((t) => [t.id, t]));

  if (clickable?.overlay) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      clickable.overlay,
      offsetX,
      offsetY,
      imgW * scaleX,
      imgH * scaleY,
    );
  }

  const timedDash = [10 * zoom, 6 * zoom];
  const drawnEdges = new Set<string>();
  const drawEdges = (otherIds: (t: Territory) => number[]) => {
    for (const t of territories) {
      for (const n of otherIds(t)) {
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
  };
  if (pick?.kind === 'link') {
    ctx.save();
    ctx.strokeStyle = PICK_LINK_COLOR;
    ctx.lineWidth = 12 * zoom;
    ctx.lineCap = 'round';
    for (const [a, b] of linkSegments(byId, pick.a, pick.b, viewport)) {
      const p1 = toScreen(a);
      const p2 = toScreen(b);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2 * zoom;
  drawEdges((t) => t.neighbors);
  ctx.save();
  ctx.lineWidth = 3 * zoom;
  ctx.setLineDash(timedDash);
  drawEdges((t) => t.timed.map((m) => m.id));
  drawEdges((t) => t.directional.map((m) => m.id));
  ctx.setLineDash([]);
  const headInset = getVertexRadius(imgW, imgH) * scaleX * 1.2;
  const headSize = 8 * zoom;
  for (const t of territories) {
    for (const m of t.directional) {
      const other = byId.get(m.id);
      if (!m.out || !other) continue;
      const segments = wrapEdgeSegments(t, other, imgW, imgH, wrapOf(t, m.id));
      const last = segments[segments.length - 1];
      arrowHead(ctx, toScreen(last[0]), toScreen(last[1]), headInset, headSize);
      if (m.backward > 0)
        arrowHead(
          ctx,
          toScreen(segments[0][1]),
          toScreen(segments[0][0]),
          headInset,
          headSize,
        );
    }
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = WIRE_COLOR;
  ctx.lineWidth = 3 * zoom;
  ctx.setLineDash([8 * zoom, 6 * zoom]);
  for (const t of territories) {
    if (!t.switch) continue;
    const from = toScreen(t);
    for (const wire of t.switch.wires) {
      const to = linkMidpoint(byId, wire.a, wire.b, viewport);
      if (!to) continue;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(to.x, to.y, 6 * zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

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
      const hovered =
        hoveredVertexId === null ? undefined : byId.get(hoveredVertexId);
      const switchPair = !!(fromTerritory.switch || hovered?.switch);
      const wrap = switchPair ? NO_WRAP : forceWrap;
      const overlapping =
        !allowCrossover &&
        segmentWouldCross(
          territories,
          viewport,
          fromTerritory,
          mouseWorldPos,
          excludeIds,
          wrap,
        );
      ctx.save();
      ctx.strokeStyle = overlapping ? '#ff0000' : '#000000';
      const dashed =
        !switchPair && (linkMode === 'timed' || linkMode === 'directional');
      ctx.lineWidth = (dashed ? 3 : 2) * zoom;
      if (dashed) ctx.setLineDash(timedDash);
      for (const [a, b] of wrapEdgeSegments(
        fromTerritory,
        mouseWorldPos,
        imgW,
        imgH,
        wrap,
      )) {
        const p1 = toScreen(a);
        const p2 = toScreen(b);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  const vertexRadius = getVertexRadius(imgW, imgH);
  const vertexBorderScale = borderScale((vertexRadius * scaleX) / zoom);
  const labels = switchLabels(territories);
  for (const t of territories) {
    const p = toScreen(t);
    const isSelected = selectedVertexId === t.id;
    const isHovered = hoveredVertexId === t.id;
    if (t.switch) {
      const width = SWITCH_WIDTH_RADII * vertexRadius * scaleX;
      const scale = zoom * vertexBorderScale;
      drawSwitchIcon(
        ctx,
        p,
        width,
        t.switch.on ? 1 : 0,
        scale,
        isSelected ? '#ffffff' : isHovered ? '#bbbbbb' : '#000000',
      );
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3 * scale;
      ctx.font = `bold ${vertexRadius * scaleX * 0.8}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelAt = p.y + vertexRadius * scaleX * 0.6;
      ctx.strokeText(labels.get(t.id)!, p.x, labelAt);
      ctx.fillText(labels.get(t.id)!, p.x, labelAt);
      continue;
    }
    const fill = t.isSea
      ? SEA_MARKER_COLOR
      : t.locked
        ? LOCKED_MARKER_COLOR
        : continentColor(t.continentId);
    ctx.beginPath();
    if (t.isSea)
      hexagonPath(ctx, p.x, p.y, vertexRadius * scaleX * SEA_SIZE_MULTIPLIER);
    else ctx.arc(p.x, p.y, vertexRadius * scaleX, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = isSelected
      ? '#ffffff'
      : isHovered
        ? '#bbbbbb'
        : '#000000';
    ctx.lineWidth =
      (isSelected || isHovered ? 7 : 2) * zoom * vertexBorderScale;
    ctx.setLineDash(
      t.locked
        ? [
            vertexRadius * scaleX * LOCKED_DASH,
            vertexRadius * scaleX * LOCKED_DASH,
          ]
        : [],
    );
    ctx.stroke();
    ctx.setLineDash([]);

    const labelRadius = t.isSea
      ? vertexRadius * scaleX * SEA_SIZE_MULTIPLIER
      : vertexRadius * scaleX;
    ctx.fillStyle = contrastTextColor(fill);
    ctx.font = `bold ${labelRadius}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const text = String(t.id + 1);
    const metrics = ctx.measureText(text);
    const baselineY =
      p.y +
      (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    ctx.fillText(text, p.x, baselineY);
  }

  if (
    linkMode !== 'select' &&
    mouseWorldPos !== null &&
    !dragging &&
    selectedVertexId === null &&
    hoveredVertexId === null &&
    !pick &&
    mouseWorldPos.x >= 0 &&
    mouseWorldPos.y >= 0 &&
    mouseWorldPos.x <= imgW &&
    mouseWorldPos.y <= imgH &&
    !pickAt(territories, viewport, toScreen(mouseWorldPos))
  )
    drawGhost(
      ctx,
      toScreen(mouseWorldPos),
      vertexRadius * scaleX,
      zoom * vertexBorderScale,
      linkMode,
      brushId,
    );

  drawTerritoryNames(
    ctx,
    territories.filter((t) => !t.isSea && !t.switch),
    territories.filter((t) => t.isSea),
    editorPlaceNames(territories),
    toScreen,
    scaleX,
    vertexRadius * scaleX,
  );

  ctx.save();
  ctx.font = `bold ${labelFontSize(viewport)}px ${CANVAS_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const shown = continentLabels(territories, continentNames).filter(
    (label) => pick?.kind === 'continent' && pick.id === label.id,
  );
  for (const label of shown) {
    const box = labelBox(label, viewport);
    const color = continentColor(label.id);
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, box.h / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 4 * zoom;
    ctx.strokeStyle = PICK_COLOR;
    ctx.stroke();
    ctx.fillStyle = contrastTextColor(color);
    ctx.fillText(label.text, box.x + box.w / 2, box.y + box.h / 2);
  }
  ctx.restore();
}
