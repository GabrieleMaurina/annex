import type { Animation, Particle } from './state';
import { jaggedPolygonPath } from './state';

const FIRE_SPEED_MIN = 70;
const FIRE_SPEED_RANGE = 230;
const FIRE_SIZE_MIN = 4;
const FIRE_SIZE_RANGE = 8;
const FIRE_LIFE_MIN = 0.25;
const FIRE_LIFE_RANGE = 0.25;
const FIRE_SPIN_MIN = -8;
const FIRE_SPIN_RANGE = 16;
const FIRE_GRAVITY = 110;
const FIRE_DRAG_RATE = 0.48;
const FIRE_FADE_WINDOW = 0.12;
const FIRE_COLORS = ['#ffca28', '#ff6d00', '#e53935'];

const SMOKE_SIZE_MIN = 10;
const SMOKE_SIZE_RANGE = 10;
const SMOKE_LIFE_MIN = 0.5;
const SMOKE_LIFE_RANGE = 0.35;
const SMOKE_DRIFT_X_RANGE = 70;
const SMOKE_DRIFT_Y_MIN = -95;
const SMOKE_DRIFT_Y_RANGE = 70;
const SMOKE_GROWTH_RATE = 12;
const SMOKE_MAX_ALPHA = 0.55;
const SMOKE_COLOR = '#555b60';

const SPARK_SPEED_MIN = 180;
const SPARK_SPEED_RANGE = 320;
const SPARK_LIFE_MIN = 0.15;
const SPARK_LIFE_RANGE = 0.3;
const SPARK_GRAVITY = 180;
const SPARK_STREAK_FACTOR = 0.025;
const SPARK_COLOR = '#ffe082';

const SHOCKWAVE_WINDOW_MS = 250;
const SHOCKWAVE_START_RADIUS = 20;
const SHOCKWAVE_GROWTH = 125;
const SHOCKWAVE_COLOR = '255, 190, 60';

const EXPLOSION_FIRE_COUNT = 42;
const EXPLOSION_SMOKE_COUNT = 22;
const EXPLOSION_SPARK_COUNT = 25;
const EXPLOSION_REFERENCE_RADIUS = 20;
const EXPLOSION_SIZE_MULTIPLIER = 1.2;

function pickFireColor(): string {
  if (Math.random() < 0.55) return FIRE_COLORS[0];
  return Math.random() < 0.65 ? FIRE_COLORS[1] : FIRE_COLORS[2];
}

function makeJitters(sides: number): number[] {
  return Array.from({ length: sides }, () => 0.75 + Math.random() * 0.4);
}

function makeSmokeBurst(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    angle: 0,
    speed: 0,
    size: SMOKE_SIZE_MIN + Math.random() * SMOKE_SIZE_RANGE,
    kind: 'smoke',
    rotation0: Math.random() * Math.PI * 2,
    maxLife: SMOKE_LIFE_MIN + Math.random() * SMOKE_LIFE_RANGE,
    vx0: (Math.random() * 2 - 1) * SMOKE_DRIFT_X_RANGE,
    vy0: SMOKE_DRIFT_Y_MIN + Math.random() * SMOKE_DRIFT_Y_RANGE,
    jitters: makeJitters(7),
  }));
}

export function makeExplosionParticles(): Particle[] {
  const fire: Particle[] = Array.from({ length: EXPLOSION_FIRE_COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: FIRE_SPEED_MIN + Math.random() * FIRE_SPEED_RANGE,
    size: FIRE_SIZE_MIN + Math.random() * FIRE_SIZE_RANGE,
    color: pickFireColor(),
    kind: 'fire',
    spin: FIRE_SPIN_MIN + Math.random() * FIRE_SPIN_RANGE,
    rotation0: Math.random() * Math.PI * 2,
    maxLife: FIRE_LIFE_MIN + Math.random() * FIRE_LIFE_RANGE,
    jitters: makeJitters(5),
  }));
  const smoke: Particle[] = makeSmokeBurst(EXPLOSION_SMOKE_COUNT);
  const sparks: Particle[] = Array.from(
    { length: EXPLOSION_SPARK_COUNT },
    () => ({
      angle: Math.random() * Math.PI * 2,
      speed: SPARK_SPEED_MIN + Math.random() * SPARK_SPEED_RANGE,
      size: 0,
      kind: 'spark',
      maxLife: SPARK_LIFE_MIN + Math.random() * SPARK_LIFE_RANGE,
    }),
  );
  return [...fire, ...smoke, ...sparks];
}

function drawSmokeParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  p: { x: number; y: number },
  scale: number,
  elapsedSeconds: number,
) {
  ctx.fillStyle = SMOKE_COLOR;
  for (const particle of particles) {
    if (particle.kind !== 'smoke') continue;
    const maxLife = particle.maxLife!;
    const t = Math.min(elapsedSeconds, maxLife);
    if (t >= maxLife) continue;
    const px = p.x + (particle.vx0 ?? 0) * t * scale;
    const py = p.y + (particle.vy0 ?? 0) * t * scale;
    const size = (particle.size + SMOKE_GROWTH_RATE * t) * scale;
    ctx.globalAlpha = Math.min(
      SMOKE_MAX_ALPHA,
      (1 - t / maxLife) * SMOKE_MAX_ALPHA,
    );
    jaggedPolygonPath(
      ctx,
      px,
      py,
      size,
      particle.rotation0 ?? 0,
      particle.jitters!,
    );
    ctx.fill();
  }
}

export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  now: number,
) {
  const scale =
    (radius * EXPLOSION_SIZE_MULTIPLIER) / EXPLOSION_REFERENCE_RADIUS;
  const elapsedMs = now - a.startedAt;
  const elapsedSeconds = elapsedMs / 1000;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  if (elapsedMs < SHOCKWAVE_WINDOW_MS) {
    const ringProgress = elapsedMs / SHOCKWAVE_WINDOW_MS;
    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y,
      (SHOCKWAVE_START_RADIUS + ringProgress * SHOCKWAVE_GROWTH) * scale,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = `rgba(${SHOCKWAVE_COLOR}, ${(1 - ringProgress) * 0.55})`;
    ctx.lineWidth = Math.max(0.5, 5 * (1 - ringProgress) * scale);
    ctx.stroke();
  }

  const particles = a.particles ?? [];

  for (const particle of particles) {
    if (particle.kind !== 'fire') continue;
    const maxLife = particle.maxLife!;
    const t = Math.min(elapsedSeconds, maxLife);
    const remaining = maxLife - t;
    if (remaining <= 0) continue;
    const vx0 = Math.cos(particle.angle) * particle.speed;
    const vy0 = Math.sin(particle.angle) * particle.speed;
    const dragIntegral = (1 - Math.exp(-FIRE_DRAG_RATE * t)) / FIRE_DRAG_RATE;
    const gravityOverDrag = FIRE_GRAVITY / FIRE_DRAG_RATE;
    const dx = vx0 * dragIntegral;
    const dy = vy0 * dragIntegral + gravityOverDrag * (t - dragIntegral);
    const px = p.x + dx * scale;
    const py = p.y + dy * scale;
    const size = Math.max(0.5, particle.size * scale * (1.6 - t / maxLife));
    const rotation = (particle.rotation0 ?? 0) + (particle.spin ?? 0) * t;
    ctx.globalAlpha = Math.min(1, remaining / FIRE_FADE_WINDOW);
    ctx.fillStyle = particle.color!;
    jaggedPolygonPath(ctx, px, py, size, rotation, particle.jitters!);
    ctx.fill();
  }

  drawSmokeParticles(ctx, particles, p, scale, elapsedSeconds);

  ctx.strokeStyle = SPARK_COLOR;
  ctx.lineWidth = Math.max(1, 2 * scale);
  for (const particle of particles) {
    if (particle.kind !== 'spark') continue;
    const maxLife = particle.maxLife!;
    const t = Math.min(elapsedSeconds, maxLife);
    if (t >= maxLife) continue;
    const vx0 = Math.cos(particle.angle) * particle.speed;
    const vy0 = Math.sin(particle.angle) * particle.speed;
    const dx = vx0 * t;
    const dy = vy0 * t + 0.5 * SPARK_GRAVITY * t * t;
    const px = p.x + dx * scale;
    const py = p.y + dy * scale;
    const vyNow = vy0 + SPARK_GRAVITY * t;
    ctx.globalAlpha = 1 - t / maxLife;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      px - vx0 * SPARK_STREAK_FACTOR * scale,
      py - vyNow * SPARK_STREAK_FACTOR * scale,
    );
    ctx.stroke();
  }

  ctx.restore();
}
