export type AnimationType = 'deploy' | 'explosion';

interface Particle {
  angle: number;
  speed: number;
  size: number;
  color: string;
  isSmoke: boolean;
}

interface Animation {
  type: AnimationType;
  x: number;
  y: number;
  startedAt: number;
  label?: string;
  labelColor?: string;
  particles?: Particle[];
}

const DURATIONS: Record<AnimationType, number> = {
  deploy: 400,
  explosion: 800,
};
const LABEL_DURATION = 1500;

const FIRE_COLORS = ['#fff2b0', '#ffd54a', '#ff9640', '#ff4d2e'];
const SMOKE_COLORS = ['#1c1c1c', '#2a2a2a', '#3a3a3a'];
const EXPLOSION_PARTICLE_COUNT = 40;
const EXPLOSION_REFERENCE_RADIUS = 20;

function makeExplosionParticles(): Particle[] {
  return Array.from({ length: EXPLOSION_PARTICLE_COUNT }, () => {
    const isSmoke = Math.random() < 0.4;
    return {
      angle: Math.random() * Math.PI * 2,
      speed: isSmoke ? 10 + Math.random() * 25 : 25 + Math.random() * 55,
      size: isSmoke ? 6 + Math.random() * 7 : 3 + Math.random() * 5,
      color: isSmoke
        ? SMOKE_COLORS[Math.floor(Math.random() * SMOKE_COLORS.length)]
        : FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
      isSmoke,
    };
  });
}

function animationLifetime(a: Animation): number {
  return a.label
    ? Math.max(DURATIONS[a.type], LABEL_DURATION)
    : DURATIONS[a.type];
}

let animations: Animation[] = [];
let disabled = false;
let continuousAnimationActive = false;
const toggleListeners = new Set<() => void>();

export function onAnimationsToggle(listener: () => void): () => void {
  toggleListeners.add(listener);
  return () => toggleListeners.delete(listener);
}

export function startAnimation(
  type: AnimationType,
  x: number,
  y: number,
  label?: string,
  labelColor?: string,
) {
  if (disabled) return;
  animations.push({
    type,
    x,
    y,
    startedAt: performance.now(),
    label,
    labelColor,
    particles: type === 'explosion' ? makeExplosionParticles() : undefined,
  });
}

export function areAnimationsDisabled(): boolean {
  return disabled;
}

export function toggleAnimationsDisabled() {
  disabled = !disabled;
  if (disabled) animations = [];
  toggleListeners.forEach((listener) => listener());
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

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  now: number,
) {
  if (!a.label) return;
  const labelProgress = Math.min(1, (now - a.startedAt) / LABEL_DURATION);
  const alpha = 1 - labelProgress;
  const [r, g, b] = hexToRgb(a.labelColor ?? '#ffffff');
  const x = p.x;
  const y = p.y - radius - 8 - labelProgress * 24;
  ctx.save();
  ctx.font = `bold ${radius}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(2, radius * 0.15);
  ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
  ctx.strokeText(a.label, x, y);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.fillText(a.label, x, y);
  ctx.restore();
}

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  now: number,
) {
  const duration = DURATIONS.explosion;
  const progress = Math.min(1, (now - a.startedAt) / duration);
  const scale = radius / EXPLOSION_REFERENCE_RADIUS;

  ctx.save();

  if (progress < 0.25) {
    const flashProgress = progress / 0.25;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - flashProgress) * 0.9;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * (1.4 + flashProgress * 1.2), 0, Math.PI * 2);
    ctx.fillStyle = '#ffe696';
    ctx.fill();
  }

  const fireAlpha = Math.max(0, 1 - Math.pow(progress, 1.6));
  const smokeAlpha = Math.max(0, (1 - progress) * 0.85);

  function drawParticle(particle: Particle) {
    const distance = particle.speed * progress * scale;
    const drift = particle.isSmoke ? -progress * 10 * scale : 0;
    const px = p.x + Math.cos(particle.angle) * distance;
    const py = p.y + Math.sin(particle.angle) * distance + drift;
    const size =
      particle.size *
      scale *
      (particle.isSmoke ? 1 + progress * 1.2 : 1 - progress * 0.3);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.fill();
  }

  const particles = a.particles ?? [];

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = fireAlpha;
  for (const particle of particles) {
    if (!particle.isSmoke) drawParticle(particle);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = smokeAlpha;
  for (const particle of particles) {
    if (particle.isSmoke) drawParticle(particle);
  }

  ctx.restore();
}

export function drawAnimations(
  ctx: CanvasRenderingContext2D,
  toScreen: (p: { x: number; y: number }) => { x: number; y: number },
  radius: number,
) {
  const now = performance.now();
  for (const a of animations) {
    const p = toScreen({ x: a.x, y: a.y });

    if (a.type === 'explosion') {
      drawExplosion(ctx, a, p, radius, now);
    } else {
      const progress = Math.min(1, (now - a.startedAt) / DURATIONS[a.type]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * (1 + progress), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    drawLabel(ctx, a, p, radius, now);
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

  const offset = disabled
    ? 0
    : (performance.now() * ARROW_CHEVRON_SPEED) % ARROW_CHEVRON_SPACING;
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
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const [a, b] of segments) {
    drawArrowHeads(ctx, a, b);
  }
  ctx.restore();
}

export const DICE_ROLL_STEPS = 8;
export const DICE_ROLL_STEP_DURATION = 90;

export function generateDiceRollSequence(
  finalValue: number,
  steps: number = DICE_ROLL_STEPS,
): number[] {
  const sequence: number[] = [];
  let previous = -1;
  for (let i = 0; i < steps - 1; i++) {
    let value: number;
    do {
      value = 1 + Math.floor(Math.random() * 6);
    } while (value === previous);
    sequence.push(value);
    previous = value;
  }
  if (sequence.length > 0 && sequence[sequence.length - 1] === finalValue) {
    const priorValue = sequence.length > 1 ? sequence[sequence.length - 2] : -1;
    let replacement: number;
    do {
      replacement = 1 + Math.floor(Math.random() * 6);
    } while (replacement === finalValue || replacement === priorValue);
    sequence[sequence.length - 1] = replacement;
  }
  sequence.push(finalValue);
  return sequence;
}
