import { getUiScale } from '../../../ui/uiScale';
import type { PlaceNames, SeaTerritory, Territory } from '../../mapData';
import {
  CANVAS_FONT_FAMILY,
  SEA_SIZE_MULTIPLIER,
  type Point,
} from '../helpers';

const PAD_X = 4;
const BOX_H = 16;
const GAP = 4;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Marker {
  id: number;
  x: number;
  y: number;
  radius: number;
}

let cached: {
  scale: number;
  uiScale: number;
  markerRadius: number;
  markers: Marker[];
  placeNames: PlaceNames;
  widths: Map<number, number>;
} | null = null;

function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function labelRect(
  m: Marker,
  width: number,
  scale: number,
  uiScale: number,
): Rect {
  const x = m.x * scale;
  const bottom = m.y * scale - m.radius - GAP * uiScale;
  return {
    x0: x - width / 2,
    y0: bottom - BOX_H * uiScale,
    x1: x + width / 2,
    y1: bottom,
  };
}

function fittingNames(
  ctx: CanvasRenderingContext2D,
  markers: Marker[],
  placeNames: PlaceNames,
  scale: number,
  uiScale: number,
): Map<number, number> {
  const markerRects = markers.map((m) => ({
    x0: m.x * scale - m.radius,
    y0: m.y * scale - m.radius,
    x1: m.x * scale + m.radius,
    y1: m.y * scale + m.radius,
  }));
  const placed: Rect[] = [];
  const widths = new Map<number, number>();
  for (const m of markers) {
    const name = placeNames.territories.get(m.id);
    if (!name) continue;
    const width = ctx.measureText(name).width + PAD_X * 2 * uiScale;
    const rect = labelRect(m, width, scale, uiScale);
    if (markerRects.some((r) => overlaps(rect, r))) continue;
    if (placed.some((r) => overlaps(rect, r))) continue;
    placed.push(rect);
    widths.set(m.id, width);
  }
  return widths;
}

export function drawTerritoryNames(
  ctx: CanvasRenderingContext2D,
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  placeNames: PlaceNames,
  toScreen: (p: Point) => Point,
  scale: number,
  markerRadius: number,
): void {
  if (placeNames.territories.size === 0) return;
  ctx.save();
  const uiScale = getUiScale();
  ctx.font = `bold ${12 * uiScale}px ${CANVAS_FONT_FAMILY}`;
  const markers: Marker[] = [
    ...territories.map((t) => ({ ...t, radius: markerRadius })),
    ...seaTerritories.map((s) => ({
      ...s,
      radius: markerRadius * SEA_SIZE_MULTIPLIER,
    })),
  ];
  if (
    cached === null ||
    cached.scale !== scale ||
    cached.uiScale !== uiScale ||
    cached.markerRadius !== markerRadius ||
    cached.placeNames !== placeNames ||
    cached.markers.length !== markers.length ||
    cached.markers.some(
      (m, i) =>
        m.id !== markers[i].id || m.x !== markers[i].x || m.y !== markers[i].y,
    )
  )
    cached = {
      scale,
      uiScale,
      markerRadius,
      markers,
      placeNames,
      widths: fittingNames(ctx, markers, placeNames, scale, uiScale),
    };

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  const boxH = BOX_H * uiScale;
  for (const m of markers) {
    const boxW = cached.widths.get(m.id);
    if (boxW === undefined) continue;
    const name = placeNames.territories.get(m.id)!;
    const p = toScreen(m);
    const boxY = p.y - m.radius - GAP * uiScale - boxH;
    ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(p.x - boxW / 2, boxY, boxW, boxH, 4 * uiScale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, p.x, boxY + boxH / 2 + uiScale);
  }
  ctx.restore();
}
