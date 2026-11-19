import type { LockedTile } from '../../lib/types';
import { clamp, type Point } from '../mapMath';
import { regionAt, type ClickableRegions } from '../regions/clickableRegions';
import { tileAt } from '../tiles/unlock';
import {
  HIT_RADIUS_MULTIPLIER,
  HIT_TOLERANCE,
  SEA_SIZE_MULTIPLIER,
} from './helpers';

export interface PanelObstacle {
  x: number;
  y: number;
  id?: number;
  sea?: boolean;
  tile?: LockedTile;
}

interface PanelView {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  vertexRadius: number;
}

interface Spot {
  left: number;
  top: number;
}

interface PlacementInput {
  anchor: Point;
  anchorRadius: number;
  width: number;
  height: number;
  screenW: number;
  screenH: number;
  gap: number;
  edgeMargin: number;
  reservedBottom: number;
  covers: (x: number, y: number) => boolean;
}

const SAMPLE_STEP = 6;
const RING_STEP = 12;
const RING_GROWTH = 0.08;
const MAX_CANDIDATES = 600;
const DIRECTION_DEGREES = [
  90, 270, 0, 180, 45, 135, 315, 225, 67.5, 112.5, 247.5, 292.5, 22.5, 157.5,
  337.5, 202.5,
];
const DIRECTIONS = DIRECTION_DEGREES.map((degrees) => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180),
}));

export function coversObstacles(
  obstacles: PanelObstacle[],
  regions: ClickableRegions | null,
  { scaleX, scaleY, offsetX, offsetY, vertexRadius }: PanelView,
): (x: number, y: number) => boolean {
  const markerRadius = vertexRadius * scaleX;
  const hitRadius = markerRadius * HIT_RADIUS_MULTIPLIER + HIT_TOLERANCE;
  const targets = obstacles.map((obstacle) => {
    const clickable =
      obstacle.id !== undefined && regions?.shapes.has(obstacle.id) === true;
    const radius =
      clickable || obstacle.tile
        ? markerRadius * (obstacle.sea ? SEA_SIZE_MULTIPLIER : 1)
        : hitRadius;
    return {
      ...obstacle,
      centerX: obstacle.x * scaleX + offsetX,
      centerY: obstacle.y * scaleY + offsetY,
      radiusSquared: radius * radius,
    };
  });
  return (x, y) => {
    const imageX = (x - offsetX) / scaleX;
    const imageY = (y - offsetY) / scaleY;
    return targets.some(
      (target) =>
        (x - target.centerX) ** 2 + (y - target.centerY) ** 2 <=
          target.radiusSquared ||
        (target.tile !== undefined &&
          tileAt([target.tile], imageX, imageY) !== null) ||
        (target.id !== undefined &&
          regions !== null &&
          regionAt(regions, imageX, imageY) === target.id),
    );
  };
}

function coveredSamples(
  spot: Spot,
  width: number,
  height: number,
  margin: number,
  covers: (x: number, y: number) => boolean,
  limit: number,
): number {
  const left = spot.left - margin;
  const top = spot.top - margin;
  const right = spot.left + width + margin;
  const bottom = spot.top + height + margin;
  let count = 0;
  for (let y = top; ; y = Math.min(y + SAMPLE_STEP, bottom)) {
    for (let x = left; ; x = Math.min(x + SAMPLE_STEP, right)) {
      if (covers(x, y)) {
        count++;
        if (count >= limit) return count;
      }
      if (x === right) break;
    }
    if (y === bottom) break;
  }
  return count;
}

export function placePanel({
  anchor,
  anchorRadius,
  width,
  height,
  screenW,
  screenH,
  gap,
  edgeMargin,
  reservedBottom,
  covers,
}: PlacementInput): Spot {
  const maxLeft = Math.max(edgeMargin, screenW - width - edgeMargin);
  const maxTop = Math.max(edgeMargin, screenH - reservedBottom - height);
  const fit = (left: number, top: number): Spot => ({
    left: clamp(left, edgeMargin, maxLeft),
    top: clamp(top, edgeMargin, maxTop),
  });
  const maxReach = Math.hypot(screenW, screenH);
  const tried = new Set<string>();
  let best: Spot | null = null;
  let bestOverlap = Infinity;
  let evaluated = 0;
  for (
    let reach = anchorRadius + gap;
    reach <= maxReach && evaluated < MAX_CANDIDATES;
    reach += Math.max(RING_STEP, reach * RING_GROWTH)
  ) {
    for (const direction of DIRECTIONS) {
      const halfExtent =
        (Math.abs(direction.x) * width + Math.abs(direction.y) * height) / 2;
      const spot = fit(
        anchor.x + direction.x * (reach + halfExtent) - width / 2,
        anchor.y + direction.y * (reach + halfExtent) - height / 2,
      );
      const key = `${spot.left}:${spot.top}`;
      if (tried.has(key)) continue;
      tried.add(key);
      evaluated++;
      const overlap = coveredSamples(
        spot,
        width,
        height,
        gap / 2,
        covers,
        bestOverlap,
      );
      if (overlap === 0) return spot;
      if (overlap < bestOverlap) {
        best = spot;
        bestOverlap = overlap;
      }
    }
  }
  return best ?? fit(anchor.x - width / 2, anchor.y + anchorRadius + gap);
}
