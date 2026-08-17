export type AnimationType = 'deploy';

interface Animation {
  type: AnimationType;
  x: number;
  y: number;
  startedAt: number;
}

const DURATIONS: Record<AnimationType, number> = {
  deploy: 400,
};

let animations: Animation[] = [];
let disabled = false;

export function startAnimation(type: AnimationType, x: number, y: number) {
  if (disabled) return;
  animations.push({ type, x, y, startedAt: performance.now() });
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
  animations = animations.filter((a) => now - a.startedAt < DURATIONS[a.type]);
}

export function hasActiveAnimations(): boolean {
  return animations.length > 0;
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
  }
}
