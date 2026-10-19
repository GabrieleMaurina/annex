import { loadWhiteIcon } from '../../../common/icon';
import { contrastTextColor } from '../../../lib/palette';
import { CHEVRONS_PER_MS, drawSplitArrow } from '../../animations/arrow';
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
import type { TimedLink } from '../hooks/view/useTimedConnections';

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
  ctx.font = `bold ${fontSize}px sans-serif`;
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

export function drawTimedLinks(
  ctx: CanvasRenderingContext2D,
  links: TimedLink[],
  pointById: Map<number, Point>,
  toScreen: (p: Point) => Point,
  imgW: number,
  imgH: number,
  forcedWraps: ForcedWraps,
  vertexRadius: number,
  mapScale: number,
  backdrop: TimedBackdrop,
) {
  const screenRadius = vertexRadius * mapScale;
  const scale = radiusScale(screenRadius);
  const iconHalf = (ICON_RADII * vertexRadius) / 2;
  const animated = !areAnimationsDisabled();
  const now = performance.now();
  const motions = motionsOf(backdrop.image);
  for (const link of links) {
    const a = pointById.get(link.a);
    const b = pointById.get(link.b);
    if (!a || !b) continue;
    const { at, along } = midpoint(
      buildWrappedPathSegments([a, b], (p) => p, imgW, imgH, forcedWraps),
    );
    const { x: nx, y: ny } = snappedNormal(along);
    const motion = motionOf(motions, link, now);
    drawSplitArrow(
      ctx,
      buildWrappedPathSegments([a, b], toScreen, imgW, imgH, forcedWraps),
      screenRadius,
      animated ? phaseAt(motion, now) : 0,
      animated ? closednessAt(motion, now) : link.open ? 0 : 1,
    );

    const offset = SIDE_OFFSET_RADII * vertexRadius;
    const iconAt = { x: at.x + nx * offset, y: at.y + ny * offset };
    const countAt = { x: at.x - nx * offset, y: at.y - ny * offset };

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
      String(link.roundsLeft),
      COUNT_FONT_RADII * screenRadius,
      contrastAt(backdrop, countAt, iconHalf),
      scale,
    );
  }
}
