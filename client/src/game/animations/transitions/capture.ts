import { lighten } from '../../../lib/palette';
import type { Point } from '../../GameMap/helpers';
import type { Territory } from '../../mapData';
import type { ClickableRegions } from '../../regions/clickableRegions';
import { animationNow, isClockVirtual } from '../clock';

const CAPTURE_MS = 1000;
const RING_WIDTH = 0.15;
export const RING_LIGHTEN = 0.6;

type Box = [number, number, number, number];

export interface Capture {
  from: string;
  dir: Point | null;
  startedAt: number;
  ringWidth: number;
}

export interface Ripple {
  from: string;
  x: number;
  y: number;
  radius: number;
  ring: number;
  ringWidth: number;
}

interface CaptureView {
  territories: Territory[];
  visibleSet: Set<number> | null;
  ownerOf: (id: number) => number | undefined;
  colorOf: (ownerId: number | undefined) => string;
  pointById: Map<number, Point>;
  vertexRadius: number;
  ready: boolean;
  animate: boolean;
}

interface Tracker {
  owners: Map<number, number | undefined>;
  captures: Map<number, Capture>;
}

const trackers = new WeakMap<HTMLCanvasElement, Tracker>();
const sources = new Map<number, number>();
const boxesByRegions = new WeakMap<ClickableRegions, Box[]>();
let activeUntil = 0;

export function noteCaptureSource(territoryId: number, sourceId: number) {
  sources.set(territoryId, sourceId);
}

export function capturesActive(): boolean {
  return performance.now() < activeUntil;
}

function attackDirection(
  territory: Territory,
  owner: number,
  view: CaptureView,
): Point | null {
  const source = sources.get(territory.id);
  sources.delete(territory.id);
  const fromIds =
    source !== undefined
      ? [source]
      : territory.neighbors.filter((id) => view.ownerOf(id) === owner);
  let x = 0;
  let y = 0;
  for (const id of fromIds) {
    const from = view.pointById.get(id);
    if (!from) continue;
    const length = Math.hypot(territory.x - from.x, territory.y - from.y);
    if (length === 0) continue;
    x += (territory.x - from.x) / length;
    y += (territory.y - from.y) / length;
  }
  const length = Math.hypot(x, y);
  return length > 0.01 ? { x: x / length, y: y / length } : null;
}

export function trackCaptures(
  canvas: HTMLCanvasElement,
  view: CaptureView,
): Map<number, Capture> {
  let tracker = trackers.get(canvas);
  const intro = !tracker;
  if (!tracker) {
    if (!view.ready) return new Map();
    tracker = { owners: new Map(), captures: new Map() };
    trackers.set(canvas, tracker);
  }
  const { owners, captures } = tracker;
  const now = animationNow();
  for (const [id, capture] of captures)
    if (!view.animate || now - capture.startedAt >= CAPTURE_MS)
      captures.delete(id);
  if (!view.animate) sources.clear();

  for (const t of view.territories) {
    if (view.visibleSet && !view.visibleSet.has(t.id)) {
      owners.delete(t.id);
      sources.delete(t.id);
      continue;
    }
    const owner = view.ownerOf(t.id);
    const changed = intro
      ? owner !== undefined
      : owners.has(t.id) && owners.get(t.id) !== owner;
    const from = view.colorOf(owners.get(t.id));
    owners.set(t.id, owner);
    if (!changed || !view.animate) continue;
    captures.set(t.id, {
      from,
      dir:
        intro || owner === undefined ? null : attackDirection(t, owner, view),
      startedAt: now,
      ringWidth: view.vertexRadius * RING_WIDTH,
    });
    if (!isClockVirtual())
      activeUntil = Math.max(activeUntil, now + CAPTURE_MS);
  }
  return captures;
}

function rippleIn(
  capture: Capture,
  center: Point,
  box: Box,
  ringWidth: number,
): Ripple {
  const progress = Math.min(
    1,
    (animationNow() - capture.startedAt) / CAPTURE_MS,
  );
  const dir = capture.dir ?? { x: 0, y: 0 };
  const corners = [
    [box[0], box[1]],
    [box[2], box[1]],
    [box[0], box[3]],
    [box[2], box[3]],
  ];
  const reach = Math.max(
    0,
    ...corners.map(([x, y]) => (center.x - x) * dir.x + (center.y - y) * dir.y),
  );
  const x = center.x - dir.x * reach;
  const y = center.y - dir.y * reach;
  const maxRadius = Math.max(
    ...corners.map(([cx, cy]) => Math.hypot(cx - x, cy - y)),
  );
  return {
    from: capture.from,
    x,
    y,
    radius: maxRadius * (1 - (1 - progress) ** 3),
    ring: Math.sin(Math.PI * progress),
    ringWidth,
  };
}

function regionBoxes(regions: ClickableRegions): Box[] {
  const cached = boxesByRegions.get(regions);
  if (cached) return cached;
  const boxes: Box[] = [];
  const { fillLabels, width } = regions;
  for (let i = 0; i < fillLabels.length; i++) {
    const id = fillLabels[i];
    if (id < 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    const box = boxes[id];
    if (!box) {
      boxes[id] = [x, y, x + 1, y + 1];
      continue;
    }
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x + 1);
    box[3] = Math.max(box[3], y + 1);
  }
  boxesByRegions.set(regions, boxes);
  return boxes;
}

export function regionRipple(
  regions: ClickableRegions,
  territory: Territory,
  capture: Capture,
  tint: number,
): Ripple {
  const box = regionBoxes(regions)[territory.id];
  const ripple = rippleIn(capture, territory, box, capture.ringWidth);
  return { ...ripple, from: lighten(ripple.from, tint) };
}

export function markerRipple(
  capture: Capture | undefined,
  center: Point,
  radius: number,
): Ripple | null {
  if (!capture) return null;
  const box: Box = [
    center.x - radius,
    center.y - radius,
    center.x + radius,
    center.y + radius,
  ];
  return rippleIn(capture, center, box, radius * RING_WIDTH);
}

export function fillWithRipple(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  color: string,
  ripple: Ripple | null | undefined,
) {
  ctx.fillStyle = ripple ? ripple.from : color;
  ctx.fill(path);
  if (!ripple) return;
  ctx.save();
  ctx.clip(path);
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = ripple.ring;
  ctx.strokeStyle = lighten(color, RING_LIGHTEN);
  ctx.lineWidth = ripple.ringWidth;
  ctx.stroke();
  ctx.restore();
}
