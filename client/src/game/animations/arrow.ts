import { areAnimationsDisabled } from './state';

const ARROW_CHEVRON_SPACING = 18;
const ARROW_CHEVRON_SPEED = 0.05;
const ARROW_CHEVRON_SIZE = 10;
// How far past a map-wrap split point (not a real territory endpoint) to
// keep drawing chevrons, so the trail slides off one edge and back in from
// the other instead of abruptly stopping/starting exactly at the border.
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

  // t0 > 0 means `from` is a synthetic split point (the trail enters here
  // after wrapping from the opposite edge), so bleed backward past it. t1 <
  // 1 means `to` is a synthetic split point (the trail continues past it on
  // the other edge), so bleed forward past it. Real endpoints (t0 === 0 /
  // t1 === 1) are never bled past. The map-bounds clip callers apply around
  // arrow drawing still cuts these off exactly at the border either way —
  // that's the point: it makes the trail look like it continues underneath
  // the clipped-away band instead of a chevron abruptly popping in/out of
  // existence right at the edge as the animation phase cycles.
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
    // t is the chevron's position along the whole logical arrow (t0..t1),
    // not just this rendered segment, so a fade stays continuous across a
    // wrap split instead of resetting at the map edge. Clamped because the
    // bleed can overshoot past 0/1 on a short split segment, and
    // ctx.globalAlpha silently ignores out-of-range values.
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
