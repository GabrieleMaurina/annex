import { areAnimationsDisabled, radiusScale } from './state';

const ARROW_CHEVRON_SPACING = 18;
const ARROW_CHEVRON_SPEED = 0.05;
const ARROW_CHEVRON_SIZE = 10;
const ARROW_WRAP_BLEED = ARROW_CHEVRON_SPACING * 1.5;
const ARROW_LINE_WIDTH = 4;

function drawArrowHeads(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  scale: number,
  fade?: 'start' | 'end',
  t0 = 0,
  t1 = 1,
) {
  const spacing = ARROW_CHEVRON_SPACING * scale;
  const size = ARROW_CHEVRON_SIZE * scale;
  const wrapBleed = ARROW_WRAP_BLEED * scale;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  const ux = dx / length;
  const uy = dy / length;
  const perpX = -uy;
  const perpY = ux;

  const bleedStart = t0 > 0 ? wrapBleed : 0;
  const bleedEnd = t1 < 1 ? wrapBleed : 0;

  const offset = areAnimationsDisabled()
    ? 0
    : (performance.now() * ARROW_CHEVRON_SPEED * scale) % spacing;
  const start = offset - Math.ceil(bleedStart / spacing) * spacing;
  for (let d = start; d < length + bleedEnd; d += spacing) {
    if (d < -bleedStart) continue;
    const t = Math.min(1, Math.max(0, t0 + (d / length) * (t1 - t0)));
    ctx.globalAlpha = fade === 'start' ? t : fade === 'end' ? 1 - t : 1;
    const cx = from.x + ux * d;
    const cy = from.y + uy * d;
    ctx.beginPath();
    ctx.moveTo(cx - ux * size + perpX * size, cy - uy * size + perpY * size);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - ux * size - perpX * size, cy - uy * size - perpY * size);
    ctx.stroke();
  }
}

export function drawFortifyPath(
  ctx: CanvasRenderingContext2D,
  segments: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    t0?: number;
    t1?: number;
  }[],
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
