export type AnimationType = 'deploy';

interface Animation {
  type: AnimationType;
  x: number;
  y: number;
  startedAt: number;
  label?: string;
}

const DURATIONS: Record<AnimationType, number> = {
  deploy: 400,
};
const LABEL_DURATION = 1500;

function animationLifetime(a: Animation): number {
  return a.label
    ? Math.max(DURATIONS[a.type], LABEL_DURATION)
    : DURATIONS[a.type];
}

let animations: Animation[] = [];
let disabled = false;
let continuousAnimationActive = false;

export function startAnimation(
  type: AnimationType,
  x: number,
  y: number,
  label?: string,
) {
  if (disabled) return;
  animations.push({ type, x, y, startedAt: performance.now(), label });
}

export function areAnimationsDisabled(): boolean {
  return disabled;
}

export function toggleAnimationsDisabled() {
  disabled = !disabled;
  if (disabled) animations = [];
}

export function pruneAnimations() {
  const now = performance.now();
  animations = animations.filter(
    (a) => now - a.startedAt < animationLifetime(a),
  );
}

export function setContinuousAnimation(active: boolean) {
  continuousAnimationActive = active && !disabled;
}

export function hasActiveAnimations(): boolean {
  return animations.length > 0 || (continuousAnimationActive && !disabled);
}

export function getAnimationDuration(type: AnimationType): number {
  return DURATIONS[type];
}

export function drawAnimations(
  ctx: CanvasRenderingContext2D,
  toScreen: (p: { x: number; y: number }) => { x: number; y: number },
  radius: number,
) {
  const now = performance.now();
  for (const a of animations) {
    const progress = Math.min(1, (now - a.startedAt) / DURATIONS[a.type]);
    const p = toScreen({ x: a.x, y: a.y });
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * (1 + progress), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (a.label) {
      const labelProgress = Math.min(1, (now - a.startedAt) / LABEL_DURATION);
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${1 - labelProgress})`;
      ctx.font = `bold ${radius}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(a.label, p.x, p.y - radius - 8 - labelProgress * 24);
      ctx.restore();
    }
  }
}

const ARROW_CHEVRON_SPACING = 18;
const ARROW_CHEVRON_SPEED = 0.05;
const ARROW_CHEVRON_SIZE = 10;

function drawArrowHeads(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  const ux = dx / length;
  const uy = dy / length;
  const perpX = -uy;
  const perpY = ux;

  const offset =
    (performance.now() * ARROW_CHEVRON_SPEED) % ARROW_CHEVRON_SPACING;
  for (let d = offset; d < length; d += ARROW_CHEVRON_SPACING) {
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

// segments are already trimmed/wrap-split screen-space points — see
// buildWrappedPathSegments in mapMath.ts.
export function drawFortifyPath(
  ctx: CanvasRenderingContext2D,
  segments: [{ x: number; y: number }, { x: number; y: number }][],
) {
  if (disabled) return;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const [a, b] of segments) {
    drawArrowHeads(ctx, a, b);
  }
  ctx.restore();
}
