import { areAnimationsDisabled, radiusScale } from './state';

const ARROW_CHEVRON_SPACING = 18;
const ARROW_CHEVRON_SPEED = 0.05;
const ARROW_CHEVRON_SIZE = 10;
const ARROW_WRAP_BLEED = ARROW_CHEVRON_SPACING * 1.5;
const ARROW_LINE_WIDTH = 4;
const SPLIT_ARROW_WING = 6;
export const CHEVRONS_PER_MS = ARROW_CHEVRON_SPEED / ARROW_CHEVRON_SPACING;

interface ArrowSegment {
  a: { x: number; y: number };
  b: { x: number; y: number };
  t0?: number;
  t1?: number;
}

function forEachChevron(
  from: { x: number; y: number },
  to: { x: number; y: number },
  scale: number,
  phase: number,
  t0: number,
  t1: number,
  draw: (cx: number, cy: number, ux: number, uy: number, t: number) => void,
) {
  const spacing = ARROW_CHEVRON_SPACING * scale;
  const wrapBleed = ARROW_WRAP_BLEED * scale;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  const ux = dx / length;
  const uy = dy / length;

  const bleedStart = t0 > 0 ? wrapBleed : 0;
  const bleedEnd = t1 < 1 ? wrapBleed : 0;

  const offset = (((phase % 1) + 1) % 1) * spacing;
  const start = offset - Math.ceil(bleedStart / spacing) * spacing;
  for (let d = start; d < length + bleedEnd; d += spacing) {
    if (d < -bleedStart) continue;
    const t = Math.min(1, Math.max(0, t0 + (d / length) * (t1 - t0)));
    draw(from.x + ux * d, from.y + uy * d, ux, uy, t);
  }
}

function drawArrowHeads(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  scale: number,
  fade?: 'start' | 'end',
  t0 = 0,
  t1 = 1,
) {
  const size = ARROW_CHEVRON_SIZE * scale;
  const phase = areAnimationsDisabled()
    ? 0
    : performance.now() * CHEVRONS_PER_MS;
  forEachChevron(from, to, scale, phase, t0, t1, (cx, cy, ux, uy, t) => {
    ctx.globalAlpha = fade === 'start' ? t : fade === 'end' ? 1 - t : 1;
    ctx.beginPath();
    ctx.moveTo(cx - ux * size - uy * size, cy - uy * size + ux * size);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - ux * size + uy * size, cy - uy * size - ux * size);
    ctx.stroke();
  });
}

export function drawFortifyPath(
  ctx: CanvasRenderingContext2D,
  segments: ArrowSegment[],
  radius: number,
  fade?: 'start' | 'end',
) {
  const scale = radiusScale(radius);
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = ARROW_LINE_WIDTH * scale;
  ctx.lineCap = 'round';
  for (const seg of segments) {
    drawArrowHeads(ctx, seg.a, seg.b, scale, fade, seg.t0 ?? 0, seg.t1 ?? 1);
  }
  ctx.restore();
}

export function drawSplitArrow(
  ctx: CanvasRenderingContext2D,
  segments: ArrowSegment[],
  radius: number,
  phase: number,
  closedness: number,
) {
  const scale = radiusScale(radius);
  const wing = SPLIT_ARROW_WING * scale;
  const angle = (Math.PI / 4) * (1 + closedness);
  const back = Math.cos(angle) * wing;
  const side = Math.sin(angle) * wing;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = ARROW_LINE_WIDTH * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const seg of segments) {
    const t0 = seg.t0 ?? 0;
    const t1 = seg.t1 ?? 1;
    forEachChevron(seg.a, seg.b, scale, phase, t0, t1, (cx, cy, ux, uy) => {
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - ux * back - uy * side, cy - uy * back + ux * side);
    });
    forEachChevron(seg.a, seg.b, scale, -phase, t0, t1, (cx, cy, ux, uy) => {
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + ux * back + uy * side, cy + uy * back - ux * side);
    });
  }
  ctx.stroke();
  ctx.restore();
}
