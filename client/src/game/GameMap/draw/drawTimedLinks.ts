import { loadWhiteIcon } from '../../../common/icon';
import { contrastTextColor } from '../../../lib/palette';
import {
  CHEVRONS_PER_MS,
  drawDirectionalArrow,
  drawSplitArrow,
} from '../../animations/arrow';
import { areAnimationsDisabled, radiusScale } from '../../animations/state';
import {
  buildWrappedPathSegments,
  type ForcedWraps,
  type Point,
  type WrappedSegment,
} from '../../mapMath';
import {
  regionAt,
  type ClickableRegions,
} from '../../regions/clickableRegions';
import { CANVAS_FONT_FAMILY } from '../helpers';
import type { DirectionalLink } from '../hooks/view/useDirectionalConnections';
import type { TimedLink } from '../hooks/view/useTimedConnections';
import type { SwitchedLinkSpot } from './drawSwitches';

const HOURGLASS_SRC = '/icons/hourglass.svg';
const ICON_RADII = 1;
const SIDE_OFFSET_RADII = 1.1;
const COUNT_FONT_RADII = 1.1;
const ICON_OUTLINE = 2;
const BLACK = '#000000';
const WHITE = '#ffffff';
const TRANSITION_MS = 1200;
const TIMED_CHEVRONS_PER_MS = CHEVRONS_PER_MS / 3;

interface LinkMotion {
  open: boolean;
  since: number;
  base: number;
  target: number;
}

const motionsByImage = new WeakMap<HTMLImageElement, Map<string, LinkMotion>>();

function motionsOf(image: HTMLImageElement | null): Map<string, LinkMotion> {
  if (!image) return new Map();
  const motions = motionsByImage.get(image) ?? new Map<string, LinkMotion>();
  motionsByImage.set(image, motions);
  return motions;
}

function phaseAt(motion: LinkMotion, now: number): number {
  const elapsed = now - motion.since;
  const p = Math.min(1, elapsed / TRANSITION_MS);
  if (!motion.open)
    return motion.base + (motion.target - motion.base) * (1 - (1 - p) ** 2);
  return elapsed < TRANSITION_MS
    ? motion.base + (TIMED_CHEVRONS_PER_MS * elapsed ** 2) / (2 * TRANSITION_MS)
    : motion.base + TIMED_CHEVRONS_PER_MS * (elapsed - TRANSITION_MS / 2);
}

function closednessAt(motion: LinkMotion, now: number): number {
  const p = Math.min(1, (now - motion.since) / TRANSITION_MS);
  return motion.open ? (1 - p) ** 2 : p ** 2;
}

function motionOf(
  motions: Map<string, LinkMotion>,
  link: TimedLink,
  now: number,
): LinkMotion {
  const key = `${link.a},${link.b}`;
  const motion = motions.get(key);
  if (motion && motion.open === link.open) return motion;
  const base = motion ? phaseAt(motion, now) : 0;
  const next = {
    open: link.open,
    since: motion ? now : now - TRANSITION_MS,
    base,
    target: Math.round(base + (TIMED_CHEVRONS_PER_MS * TRANSITION_MS) / 2),
  };
  motions.set(key, next);
  return next;
}

const hourglassIcons: Record<string, HTMLImageElement> = {
  [BLACK]: new Image(),
  [WHITE]: new Image(),
};

function loadImage(image: HTMLImageElement, src: string): Promise<void> {
  return new Promise((resolve) => {
    image.onload = () => resolve();
    image.src = src;
  });
}

export function loadHourglassIcons(): Promise<void[]> {
  return Promise.all([
    loadImage(hourglassIcons[BLACK], HOURGLASS_SRC),
    loadWhiteIcon(HOURGLASS_SRC).then((src) =>
      loadImage(hourglassIcons[WHITE], src),
    ),
  ]);
}

function opposite(color: string): string {
  return color === BLACK ? WHITE : BLACK;
}

function midpoint(segments: WrappedSegment[]): { at: Point; along: Point } {
  const seg = segments.find((s) => s.t0 <= 0.5 && 0.5 <= s.t1)!;
  const k = (0.5 - seg.t0) / (seg.t1 - seg.t0);
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    at: { x: seg.a.x + dx * k, y: seg.a.y + dy * k },
    along: { x: dx / length, y: dy / length },
  };
}

const SNAPPED_NORMALS: Point[] = [
  { x: 1, y: 0 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: 0, y: 1 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -1, y: 0 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
];

function snappedNormal(along: Point): Point {
  const step = Math.round(Math.atan2(along.x, -along.y) / (Math.PI / 4));
  const normal = SNAPPED_NORMALS[((step % 8) + 8) % 8];
  return normal.y > 0 || (normal.y === 0 && normal.x > 0)
    ? { x: -normal.x, y: -normal.y }
    : normal;
}

export interface TimedBackdrop {
  image: HTMLImageElement | null;
  regions: ClickableRegions | null;
  fillColors: Map<number, string>;
}

interface ImageSampler {
  ctx: CanvasRenderingContext2D;
  colors: Map<string, string>;
}

const imageSamplers = new WeakMap<HTMLImageElement, ImageSampler>();

function imageSampler(image: HTMLImageElement): ImageSampler {
  let sampler = imageSamplers.get(image);
  if (!sampler) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    sampler = { ctx, colors: new Map() };
    imageSamplers.set(image, sampler);
  }
  return sampler;
}

function averageContrast(
  ctx: CanvasRenderingContext2D,
  center: Point,
  half: number,
): string {
  const x0 = Math.max(0, Math.floor(center.x - half));
  const y0 = Math.max(0, Math.floor(center.y - half));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(center.x + half));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(center.y + half));
  if (x1 <= x0 || y1 <= y0) return WHITE;
  const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const count = data.length / 4;
  const sum = [0, 0, 0];
  for (let o = 0; o < data.length; o += 4)
    for (let c = 0; c < 3; c++) sum[c] += data[o + c];
  const hex = sum
    .map((v) =>
      Math.round(v / count)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
  return contrastTextColor(`#${hex}`);
}

function contrastAt(
  backdrop: TimedBackdrop,
  center: Point,
  half: number,
): string {
  const id = backdrop.regions
    ? regionAt(backdrop.regions, center.x, center.y)
    : null;
  const fill = id === null ? undefined : backdrop.fillColors.get(id);
  if (fill) return contrastTextColor(fill);
  const { image } = backdrop;
  if (!image || !image.complete || image.naturalWidth === 0) return WHITE;
  const sampler = imageSampler(image);
  const key = `${center.x},${center.y},${half}`;
  let color = sampler.colors.get(key);
  if (!color) {
    color = averageContrast(sampler.ctx, center, half);
    sampler.colors.set(key, color);
  }
  return color;
}

function drawHourglass(
  ctx: CanvasRenderingContext2D,
  center: Point,
  size: number,
  color: string,
  scale: number,
) {
  const icon = hourglassIcons[color];
  const outline = hourglassIcons[opposite(color)];
  const draw = (image: HTMLImageElement, dx: number, dy: number) => {
    if (!image.complete || image.naturalWidth === 0) return;
    const x = center.x - size / 2 + dx;
    const y = center.y - size / 2 + dy;
    ctx.drawImage(image, x, y, size, size);
  };
  const w = ICON_OUTLINE * scale;
  for (const [dx, dy] of [
    [-w, 0],
    [w, 0],
    [0, -w],
    [0, w],
    [-w, -w],
    [w, -w],
    [-w, w],
    [w, w],
  ])
    draw(outline, dx, dy);
  draw(icon, 0, 0);
}

function drawCount(
  ctx: CanvasRenderingContext2D,
  center: Point,
  text: string,
  fontSize: number,
  color: string,
  scale: number,
) {
  ctx.save();
  ctx.font = `bold ${fontSize}px ${CANVAS_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = opposite(color);
  ctx.lineWidth = 4 * scale;
  ctx.strokeText(text, center.x, center.y);
  ctx.fillStyle = color;
  ctx.fillText(text, center.x, center.y);
  ctx.restore();
}

interface LinkGeometry {
  segments: WrappedSegment[];
  at: Point;
  normal: Point;
}

interface LinkLayout {
  pointById: Map<number, Point>;
  toScreen: (p: Point) => Point;
  imgW: number;
  imgH: number;
  forcedWraps: ForcedWraps;
  vertexRadius: number;
  mapScale: number;
  backdrop: TimedBackdrop;
}

function linkGeometry(
  layout: LinkLayout,
  link: { a: number; b: number },
): LinkGeometry | null {
  const { pointById, toScreen, imgW, imgH, forcedWraps } = layout;
  const a = pointById.get(link.a);
  const b = pointById.get(link.b);
  if (!a || !b) return null;
  const { at, along } = midpoint(
    buildWrappedPathSegments([a, b], (p) => p, imgW, imgH, forcedWraps),
  );
  return {
    segments: buildWrappedPathSegments(
      [a, b],
      toScreen,
      imgW,
      imgH,
      forcedWraps,
    ),
    at,
    normal: snappedNormal(along),
  };
}

function drawRoundsLeft(
  ctx: CanvasRenderingContext2D,
  layout: LinkLayout,
  { at, normal }: LinkGeometry,
  roundsLeft: number,
) {
  const { toScreen, vertexRadius, mapScale, backdrop } = layout;
  const screenRadius = vertexRadius * mapScale;
  const scale = radiusScale(screenRadius);
  const iconHalf = (ICON_RADII * vertexRadius) / 2;
  const offset = SIDE_OFFSET_RADII * vertexRadius;
  const iconAt = { x: at.x + normal.x * offset, y: at.y + normal.y * offset };
  const countAt = { x: at.x - normal.x * offset, y: at.y - normal.y * offset };

  drawHourglass(
    ctx,
    toScreen(iconAt),
    ICON_RADII * screenRadius,
    contrastAt(backdrop, iconAt, iconHalf),
    scale,
  );
  drawCount(
    ctx,
    toScreen(countAt),
    String(roundsLeft),
    COUNT_FONT_RADII * screenRadius,
    contrastAt(backdrop, countAt, iconHalf),
    scale,
  );
}

export function drawTimedLinks(
  ctx: CanvasRenderingContext2D,
  links: TimedLink[],
  layout: LinkLayout,
  spots: SwitchedLinkSpot[],
) {
  const screenRadius = layout.vertexRadius * layout.mapScale;
  const animated = !areAnimationsDisabled();
  const now = performance.now();
  const motions = motionsOf(layout.backdrop.image);
  for (const link of links) {
    const geometry = linkGeometry(layout, link);
    if (!geometry) continue;
    const motion = motionOf(motions, link, now);
    drawSplitArrow(
      ctx,
      geometry.segments,
      screenRadius,
      animated ? phaseAt(motion, now) : 0,
      animated ? closednessAt(motion, now) : link.open ? 0 : 1,
    );
    if (link.control)
      spots.push({ at: layout.toScreen(geometry.at), control: link.control });
    else if (link.roundsLeft !== null)
      drawRoundsLeft(ctx, layout, geometry, link.roundsLeft);
  }
}

interface FlipMotion {
  forward: boolean;
  since: number;
  base: number;
}

const flipsByImage = new WeakMap<HTMLImageElement, Map<string, FlipMotion>>();

function flipsOf(image: HTMLImageElement | null): Map<string, FlipMotion> {
  if (!image) return new Map();
  const flips = flipsByImage.get(image) ?? new Map<string, FlipMotion>();
  flipsByImage.set(image, flips);
  return flips;
}

function flipPhaseAt(motion: FlipMotion, now: number): number {
  const elapsed = now - motion.since;
  const half = TRANSITION_MS / 2;
  const sign = motion.forward ? 1 : -1;
  const v = TIMED_CHEVRONS_PER_MS;
  if (elapsed >= TRANSITION_MS)
    return motion.base + sign * v * (elapsed - TRANSITION_MS);
  if (elapsed < half)
    return motion.base - sign * v * (elapsed - elapsed ** 2 / (2 * half));
  return (
    motion.base -
    (sign * v * half) / 2 +
    (sign * v * (elapsed - half) ** 2) / (2 * half)
  );
}

function flipTurnAt(motion: FlipMotion, now: number): number {
  const p = Math.min(1, (now - motion.since) / TRANSITION_MS);
  const eased = p * p * (3 - 2 * p);
  return motion.forward ? 2 - 2 * eased : 2 * eased;
}

function flipOf(
  flips: Map<string, FlipMotion>,
  link: DirectionalLink,
  now: number,
): FlipMotion {
  const key = `${link.a},${link.b}`;
  const motion = flips.get(key);
  if (motion && motion.forward === link.forward) return motion;
  const next = {
    forward: link.forward,
    since: motion ? now : now - TRANSITION_MS,
    base: motion ? flipPhaseAt(motion, now) : 0,
  };
  flips.set(key, next);
  return next;
}

export function drawDirectionalLinks(
  ctx: CanvasRenderingContext2D,
  links: DirectionalLink[],
  layout: LinkLayout,
  spots: SwitchedLinkSpot[],
) {
  const screenRadius = layout.vertexRadius * layout.mapScale;
  const animated = !areAnimationsDisabled();
  const now = performance.now();
  const flips = flipsOf(layout.backdrop.image);
  for (const link of links) {
    const geometry = linkGeometry(layout, link);
    if (!geometry) continue;
    const motion = flipOf(flips, link, now);
    drawDirectionalArrow(
      ctx,
      geometry.segments,
      screenRadius,
      animated ? flipPhaseAt(motion, now) : 0,
      animated ? flipTurnAt(motion, now) : link.forward ? 0 : 2,
    );
    if (link.control)
      spots.push({ at: layout.toScreen(geometry.at), control: link.control });
    else if (link.roundsLeft !== null)
      drawRoundsLeft(ctx, layout, geometry, link.roundsLeft);
  }
}
