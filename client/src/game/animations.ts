export type AnimationType = 'deploy' | 'explosion' | 'entrench';

interface Particle {
  angle: number;
  speed: number;
  size: number;
  color?: string;
  kind: 'fire' | 'smoke' | 'spark' | 'dust';
  spin?: number;
  rotation0?: number;
  maxLife?: number;
  vx0?: number;
  vy0?: number;
  jitters?: number[];
}

interface Animation {
  type: AnimationType;
  x: number;
  y: number;
  startedAt: number;
  label?: string;
  labelColor?: string;
  particles?: Particle[];
  arrowPath?: { x: number; y: number }[];
}

const DURATIONS: Record<AnimationType, number> = {
  deploy: 400,
  explosion: 1000,
  entrench: 700,
};
const LABEL_DURATION = 1500;
export const CARD_SET_FLASH_DURATION = 2000;

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

function jaggedPolygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  jitters: number[],
) {
  ctx.beginPath();
  for (let i = 0; i < jitters.length; i++) {
    const angle = rotation + (i * Math.PI * 2) / jitters.length;
    const px = cx + Math.cos(angle) * r * jitters[i];
    const py = cy + Math.sin(angle) * r * jitters[i];
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function makeExplosionParticles(): Particle[] {
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
  const smoke: Particle[] = Array.from(
    { length: EXPLOSION_SMOKE_COUNT },
    () => ({
      angle: 0,
      speed: 0,
      size: SMOKE_SIZE_MIN + Math.random() * SMOKE_SIZE_RANGE,
      kind: 'smoke',
      rotation0: Math.random() * Math.PI * 2,
      maxLife: SMOKE_LIFE_MIN + Math.random() * SMOKE_LIFE_RANGE,
      vx0: (Math.random() * 2 - 1) * SMOKE_DRIFT_X_RANGE,
      vy0: SMOKE_DRIFT_Y_MIN + Math.random() * SMOKE_DRIFT_Y_RANGE,
      jitters: makeJitters(7),
    }),
  );
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

const PORTAL_RING_SCALE = 1.4;
const PORTAL_BLOB_SEGMENTS = 28;
const PORTAL_BLOB_AMP_1_MIN = 0.08;
const PORTAL_BLOB_AMP_1_RANGE = 0.08;
const PORTAL_BLOB_AMP_2_MIN = 0.04;
const PORTAL_BLOB_AMP_2_RANGE = 0.05;
const PORTAL_BLOB_DRIFT_SPEED = 0.0007;
const PORTAL_BLOB_DRIFT_AMOUNT = 0.65;
const PORTAL_SHARD_JITTERS = [0.8, 1.15, 0.85, 1.1, 0.9];
const PORTAL_SHARD_COUNT = 6;
const PORTAL_SHARD_COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd'];
const PORTAL_SHARD_SPIN_SPEED = 0.003;
const PORTAL_RING_COLOR_ENABLED = '167, 139, 250';
const PORTAL_RING_FILL_ENABLED = '124, 58, 237';
const PORTAL_RING_COLOR_DISABLED = '108, 117, 125';
const PORTAL_SPIN_SPEED = 0.0015;
const PORTAL_SPIN_SPEED_JITTER = 0.3;

const PORTAL_SPARK_SOURCE_COUNT = 6;
const PORTAL_SPARKS_PER_SOURCE = 5;
const PORTAL_SPARK_CYCLE_MS = 850;
const PORTAL_SPARK_TANGENT_SPEED = 2.6;
const PORTAL_SPARK_OUTWARD_SPEED = 0.9;
const PORTAL_SPARK_GRAVITY = 2.4;
const PORTAL_SPARK_STREAK_FACTOR = 0.05;
const PORTAL_SPARK_ANGLE_JITTER = 0.2;
const PORTAL_SPARK_ORIGIN_INSET = 0.75;
const PORTAL_SPARK_COLOR = '255, 224, 130';

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface PortalStyle {
  freq1: number;
  phase1: number;
  amp1: number;
  freq2: number;
  phase2: number;
  amp2: number;
  spinPhase: number;
  spinSpeed: number;
  driftPhase: number;
  sparkPhase: number;
  sourceOffset: number;
}

function portalStyle(seed: number): PortalStyle {
  const r = (k: number) => pseudoRandom(seed * 3.173 + k);
  return {
    freq1: 2 + Math.floor(r(1) * 3),
    phase1: r(2) * Math.PI * 2,
    amp1: PORTAL_BLOB_AMP_1_MIN + r(3) * PORTAL_BLOB_AMP_1_RANGE,
    freq2: 4 + Math.floor(r(4) * 3),
    phase2: r(5) * Math.PI * 2,
    amp2: PORTAL_BLOB_AMP_2_MIN + r(6) * PORTAL_BLOB_AMP_2_RANGE,
    spinPhase: r(7) * Math.PI * 2,
    spinSpeed:
      PORTAL_SPIN_SPEED *
      (1 - PORTAL_SPIN_SPEED_JITTER / 2 + r(8) * PORTAL_SPIN_SPEED_JITTER),
    driftPhase: r(9) * Math.PI * 2,
    sparkPhase: r(10) * PORTAL_SPARK_CYCLE_MS,
    sourceOffset: r(11) * Math.PI * 2,
  };
}

function portalBlobWobble(
  theta: number,
  now: number,
  style: PortalStyle,
): number {
  const drift =
    Math.sin(now * PORTAL_BLOB_DRIFT_SPEED + style.driftPhase) *
    PORTAL_BLOB_DRIFT_AMOUNT;
  return (
    1 +
    style.amp1 * Math.sin(theta * style.freq1 + style.phase1 + drift) +
    style.amp2 * Math.sin(theta * style.freq2 + style.phase2 - drift * 0.6)
  );
}

export const ENTRENCHED_OCTAGON_SCALE = 1.3;
const DUST_COLORS = ['#b08c5c', '#8c6a45', '#6b4f34', '#5a4530'];
const ENTRENCH_PARTICLE_COUNT = 18;
const ENTRENCH_REFERENCE_RADIUS = 20;
const ENTRENCH_RING_COLOR = '173, 181, 189';

export function traceOctagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i + Math.PI / 8;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function makeEntrenchParticles(): Particle[] {
  return Array.from({ length: ENTRENCH_PARTICLE_COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: 8 + Math.random() * 18,
    size: 3 + Math.random() * 4,
    color: DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)],
    kind: 'dust',
  }));
}

function animationLifetime(a: Animation): number {
  return a.label
    ? Math.max(DURATIONS[a.type], LABEL_DURATION)
    : DURATIONS[a.type];
}

let animations: Animation[] = [];
let disabled = false;
let continuousAnimationActive = false;
let portalsActive = false;
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
  arrowPath?: { x: number; y: number }[],
) {
  if (disabled) return;
  animations.push({
    type,
    x,
    y,
    startedAt: performance.now(),
    label,
    labelColor,
    particles:
      type === 'explosion'
        ? makeExplosionParticles()
        : type === 'entrench'
          ? makeEntrenchParticles()
          : undefined,
    arrowPath,
  });
}

export function areAnimationsDisabled(): boolean {
  return disabled;
}

export function setAnimationsDisabled(value: boolean) {
  disabled = value;
  if (disabled) animations = [];
  toggleListeners.forEach((listener) => listener());
}

export function toggleAnimationsDisabled() {
  setAnimationsDisabled(!disabled);
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

export function setPortalsActive(active: boolean) {
  portalsActive = active && !disabled;
}

export function hasActiveAnimations(): boolean {
  return (
    animations.length > 0 ||
    (continuousAnimationActive && !disabled) ||
    (portalsActive && !disabled)
  );
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

function drawEntrench(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  now: number,
) {
  const duration = DURATIONS.entrench;
  const progress = Math.min(1, (now - a.startedAt) / duration);
  const scale = radius / ENTRENCH_REFERENCE_RADIUS;

  ctx.save();

  const ringProgress = Math.min(1, progress / 0.6);
  const ringRadius =
    radius * (0.6 + ringProgress * (ENTRENCHED_OCTAGON_SCALE - 0.6));
  const ringAlpha = Math.max(0, 1 - Math.max(0, (progress - 0.4) / 0.6));
  traceOctagon(ctx, p.x, p.y, ringRadius);
  ctx.strokeStyle = `rgba(${ENTRENCH_RING_COLOR}, ${ringAlpha})`;
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  ctx.stroke();

  const dustAlpha = Math.max(0, 1 - progress);
  ctx.globalAlpha = dustAlpha;
  for (const particle of a.particles ?? []) {
    const distance = particle.speed * progress * scale;
    const fall = progress * progress * 14 * scale;
    const px = p.x + Math.cos(particle.angle) * distance;
    const py = p.y + Math.sin(particle.angle) * distance * 0.5 + fall;
    const size = particle.size * scale * (1 - progress * 0.4);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
    ctx.fillStyle = particle.color!;
    ctx.fill();
  }

  ctx.restore();
}

function portalBlobPath(
  ctx: CanvasRenderingContext2D,
  ringRadius: number,
  spin: number,
  now: number,
  style: PortalStyle,
) {
  ctx.beginPath();
  for (let i = 0; i <= PORTAL_BLOB_SEGMENTS; i++) {
    const theta = (i / PORTAL_BLOB_SEGMENTS) * Math.PI * 2;
    const r = ringRadius * portalBlobWobble(theta, now, style);
    const angle = theta + spin;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawPortal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  now: number,
  enabled: boolean,
  seed: number,
) {
  const ringRadius = radius * PORTAL_RING_SCALE;

  ctx.save();
  ctx.translate(x, y);

  if (!enabled) {
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${PORTAL_RING_COLOR_DISABLED})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${PORTAL_RING_COLOR_DISABLED}, 0.6)`;
    ctx.lineWidth = Math.max(1.5, radius * 0.12);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const style = portalStyle(seed);
  const spin = (now * style.spinSpeed + style.spinPhase) % (Math.PI * 2);

  const cycleSeconds = PORTAL_SPARK_CYCLE_MS / 1000;
  const gravity = PORTAL_SPARK_GRAVITY * radius;
  ctx.strokeStyle = `rgb(${PORTAL_SPARK_COLOR})`;
  ctx.lineWidth = Math.max(1, radius * 0.07);
  for (let s = 0; s < PORTAL_SPARK_SOURCE_COUNT; s++) {
    const slotAngle =
      (s / PORTAL_SPARK_SOURCE_COUNT) * Math.PI * 2 + style.sourceOffset;
    const edgeR = ringRadius * portalBlobWobble(slotAngle, now, style);
    const originR = edgeR * PORTAL_SPARK_ORIGIN_INSET;
    for (let k = 0; k < PORTAL_SPARKS_PER_SOURCE; k++) {
      const stagger = k / PORTAL_SPARKS_PER_SOURCE;
      const age =
        ((now + stagger * PORTAL_SPARK_CYCLE_MS + style.sparkPhase + s * 137) %
          PORTAL_SPARK_CYCLE_MS) /
        1000;
      const progress = age / cycleSeconds;
      const launchTime = now - age * 1000;
      const rand = pseudoRandom(
        seed * 131 +
          s * 977 +
          k +
          Math.floor(launchTime / PORTAL_SPARK_CYCLE_MS) * 97,
      );
      const launchAngle =
        slotAngle +
        launchTime * style.spinSpeed +
        style.spinPhase +
        (rand - 0.5) * PORTAL_SPARK_ANGLE_JITTER;
      const speedJitter = 0.7 + rand * 0.6;
      const tangentX = -Math.sin(launchAngle);
      const tangentY = Math.cos(launchAngle);
      const radialX = Math.cos(launchAngle);
      const radialY = Math.sin(launchAngle);
      const vx0 =
        (tangentX * PORTAL_SPARK_TANGENT_SPEED +
          radialX * PORTAL_SPARK_OUTWARD_SPEED) *
        radius *
        speedJitter;
      const vy0 =
        (tangentY * PORTAL_SPARK_TANGENT_SPEED +
          radialY * PORTAL_SPARK_OUTWARD_SPEED) *
        radius *
        speedJitter;
      const originX = Math.cos(launchAngle) * originR;
      const originY = Math.sin(launchAngle) * originR;
      const px = originX + vx0 * age;
      const py = originY + vy0 * age + 0.5 * gravity * age * age;
      const vyNow = vy0 + gravity * age;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(
        px - vx0 * PORTAL_SPARK_STREAK_FACTOR,
        py - vyNow * PORTAL_SPARK_STREAK_FACTOR,
      );
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  portalBlobPath(ctx, ringRadius, spin, now, style);
  ctx.fillStyle = `rgb(${PORTAL_RING_FILL_ENABLED})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${PORTAL_RING_COLOR_ENABLED}, 0.9)`;
  ctx.lineWidth = Math.max(1.5, radius * 0.12);
  ctx.stroke();

  for (let i = 0; i < PORTAL_SHARD_COUNT; i++) {
    const angle = (i / PORTAL_SHARD_COUNT) * Math.PI * 2 + spin;
    const bob =
      Math.sin(now * 0.004 + i * 1.3 + style.driftPhase) * radius * 0.08;
    const shardDist = ringRadius + bob;
    const shardRotation =
      now * PORTAL_SHARD_SPIN_SPEED * (i % 2 === 0 ? 1 : -1) +
      i +
      style.spinPhase;
    jaggedPolygonPath(
      ctx,
      Math.cos(angle) * shardDist,
      Math.sin(angle) * shardDist,
      radius * 0.2,
      shardRotation,
      PORTAL_SHARD_JITTERS,
    );
    ctx.fillStyle = PORTAL_SHARD_COLORS[i % PORTAL_SHARD_COLORS.length];
    ctx.fill();
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
    const progress = Math.min(1, (now - a.startedAt) / DURATIONS[a.type]);

    if (a.type === 'explosion') {
      drawExplosion(ctx, a, p, radius, now);
    } else if (a.type === 'entrench') {
      drawEntrench(ctx, a, p, radius, now);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * (1 + progress), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    if (progress < 1 && a.arrowPath && a.arrowPath.length > 1) {
      const screenPath = a.arrowPath.map(toScreen);
      const segments: [{ x: number; y: number }, { x: number; y: number }][] =
        [];
      for (let i = 0; i < screenPath.length - 1; i++)
        segments.push([screenPath[i], screenPath[i + 1]]);
      drawFortifyPath(ctx, segments);
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
