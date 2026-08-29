import { areAnimationsDisabled } from './state';

const ARROW_CHEVRON_SPACING = 18;
const ARROW_CHEVRON_SPEED = 0.05;
const ARROW_CHEVRON_SIZE = 10;
const ARROW_WRAP_BLEED = ARROW_CHEVRON_SPACING * 1.5;

function drawArrowHeads(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fade?: 'start' | 'end',
  t0 = 0,
  t1 = 1,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  const ux = dx / length;
  const uy = dy / length;
  const perpX = -uy;
  const perpY = ux;

  const bleedStart = t0 > 0 ? ARROW_WRAP_BLEED : 0;
  const bleedEnd = t1 < 1 ? ARROW_WRAP_BLEED : 0;

  const offset = areAnimationsDisabled()
    ? 0
    : (performance.now() * ARROW_CHEVRON_SPEED) % ARROW_CHEVRON_SPACING;
  const start =
    offset -
    Math.ceil(bleedStart / ARROW_CHEVRON_SPACING) * ARROW_CHEVRON_SPACING;
  for (let d = start; d < length + bleedEnd; d += ARROW_CHEVRON_SPACING) {
    if (d < -bleedStart) continue;
    const t = Math.min(1, Math.max(0, t0 + (d / length) * (t1 - t0)));
    ctx.globalAlpha = fade === 'start' ? t : fade === 'end' ? 1 - t : 1;
    const cx = from.x + ux * d;
    const cy = from.y + uy * d;
    ctx.beginPath();
    ctx.moveTo(
      cx - ux * ARROW_CHEVRON_SIZE + perpX * ARROW_CHEVRON_SIZE,
      cy - uy * ARROW_CHEVRON_SIZE + perpY * ARROW_CHEVRON_SIZE,
    );
    ctx.lineTo(cx, cy);
    ctx.lineTo(
      cx - ux * ARROW_CHEVRON_SIZE - perpX * ARROW_CHEVRON_SIZE,
      cy - uy * ARROW_CHEVRON_SIZE - perpY * ARROW_CHEVRON_SIZE,
    );
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
  fade?: 'start' | 'end',
) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const seg of segments) {
    drawArrowHeads(ctx, seg.a, seg.b, fade, seg.t0 ?? 0, seg.t1 ?? 1);
  }
  ctx.restore();
}
