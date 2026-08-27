import { pseudoRandom } from './state';

const TOXIN_CLOUD_SCALE = 1.4;
const TOXIN_CLOUD_COLOR = '65, 70, 75';
const TOXIN_CLOUD_COUNTDOWN_COLOR = '#f8f9fa';

export const TOXIN_PARTICLE_REFERENCE_RADIUS = 20;
export const TOXIN_PARTICLE_COUNT = 22;
export const TOXIN_PARTICLE_SIDES = 5;
export const TOXIN_PARTICLE_SIZE_MIN = 3.5;
export const TOXIN_PARTICLE_SIZE_RANGE = 3;
export const TOXIN_PARTICLE_RADIUS_MIN = 0.15;
export const TOXIN_PARTICLE_RADIUS_RANGE = 0.9;
export const TOXIN_PARTICLE_ORBIT_SPEED_MIN = 0.00025;
export const TOXIN_PARTICLE_ORBIT_SPEED_RANGE = 0.00055;
const TOXIN_PARTICLE_WANDER_SPEED_MIN = 0.0009;
const TOXIN_PARTICLE_WANDER_SPEED_RANGE = 0.0018;
const TOXIN_PARTICLE_WANDER_AMOUNT = 0.4;
export const TOXIN_PARTICLE_ROTATION_SPEED_MIN = 0.0006;
export const TOXIN_PARTICLE_ROTATION_SPEED_RANGE = 0.0016;
export const TOXIN_PARTICLE_ALPHA_MIN = 0.4;
export const TOXIN_PARTICLE_ALPHA_RANGE = 0.4;
const TOXIN_PARTICLE_ALPHA_PERMANENT_BOOST = 1.35;
const TOXIN_PLACE_BURST_DURATION = 900;

export interface ToxinParticlePosition {
  x: number;
  y: number;
  size: number;
  alpha: number;
  rotation: number;
}

export function toxinParticlePosition(
  now: number,
  seed: number,
  index: number,
  cloudRadius: number,
  expansion: number,
): ToxinParticlePosition {
  const r = (k: number) => pseudoRandom(seed * 11.31 + index * 7.919 + k);

  const orbitSpeed =
    (TOXIN_PARTICLE_ORBIT_SPEED_MIN + r(1) * TOXIN_PARTICLE_ORBIT_SPEED_RANGE) *
    (r(2) < 0.5 ? 1 : -1);
  const baseAngle =
    (index / TOXIN_PARTICLE_COUNT) * Math.PI * 2 + r(3) * Math.PI * 2;
  const angle = baseAngle + now * orbitSpeed;

  const wanderSpeed1 =
    TOXIN_PARTICLE_WANDER_SPEED_MIN + r(4) * TOXIN_PARTICLE_WANDER_SPEED_RANGE;
  const wanderSpeed2 =
    TOXIN_PARTICLE_WANDER_SPEED_MIN + r(5) * TOXIN_PARTICLE_WANDER_SPEED_RANGE;
  const wanderPhase1 = r(6) * Math.PI * 2;
  const wanderPhase2 = r(7) * Math.PI * 2;

  const baseRadiusFrac =
    TOXIN_PARTICLE_RADIUS_MIN + r(8) * TOXIN_PARTICLE_RADIUS_RANGE;
  const radiusWander =
    TOXIN_PARTICLE_WANDER_AMOUNT *
    (0.6 * Math.sin(now * wanderSpeed1 + wanderPhase1) +
      0.4 * Math.sin(now * wanderSpeed2 * 1.9 + wanderPhase2));
  const radiusFrac = Math.min(1, Math.max(0.05, baseRadiusFrac + radiusWander));
  const angleWobble = 0.5 * Math.sin(now * wanderSpeed2 + wanderPhase1);

  const dist = cloudRadius * radiusFrac * expansion;

  const rotationSpeed =
    (TOXIN_PARTICLE_ROTATION_SPEED_MIN +
      r(9) * TOXIN_PARTICLE_ROTATION_SPEED_RANGE) *
    (r(10) < 0.5 ? 1 : -1);
  const rotationPhase = r(11) * Math.PI * 2;

  return {
    x: Math.cos(angle + angleWobble) * dist,
    y: Math.sin(angle + angleWobble) * dist,
    size: TOXIN_PARTICLE_SIZE_MIN + r(12) * TOXIN_PARTICLE_SIZE_RANGE,
    alpha: TOXIN_PARTICLE_ALPHA_MIN + r(13) * TOXIN_PARTICLE_ALPHA_RANGE,
    rotation: now * rotationSpeed + rotationPhase,
  };
}

function drawToxinParticle(
  ctx: CanvasRenderingContext2D,
  particle: ToxinParticlePosition,
  sizeScale: number,
  alphaBoost: number,
) {
  const size = Math.max(0.5, particle.size * sizeScale);
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.beginPath();
  for (let i = 0; i < TOXIN_PARTICLE_SIDES; i++) {
    const angle = (i / TOXIN_PARTICLE_SIDES) * Math.PI * 2;
    const px = Math.cos(angle) * size;
    const py = Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${TOXIN_CLOUD_COLOR}, ${Math.min(1, particle.alpha * alphaBoost)})`;
  ctx.fill();
  ctx.restore();
}

export function drawToxinCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  now: number,
  permanent: boolean,
  turnsRemaining: number,
  seed: number,
  placedAt: number,
) {
  const cloudRadius = radius * TOXIN_CLOUD_SCALE;
  const sizeScale = radius / TOXIN_PARTICLE_REFERENCE_RADIUS;
  const alphaBoost = permanent ? TOXIN_PARTICLE_ALPHA_PERMANENT_BOOST : 1;
  const burstProgress = Math.min(
    1,
    Math.max(0, (now - placedAt) / TOXIN_PLACE_BURST_DURATION),
  );
  const expansion = 1 - (1 - burstProgress) ** 3;

  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < TOXIN_PARTICLE_COUNT; i++) {
    const particle = toxinParticlePosition(
      now,
      seed,
      i,
      cloudRadius,
      expansion,
    );
    drawToxinParticle(ctx, particle, sizeScale, alphaBoost);
  }
  ctx.restore();

  if (!permanent) {
    ctx.save();
    ctx.font = `bold ${Math.max(10, radius * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tx = x + cloudRadius * 0.7;
    const ty = y - cloudRadius * 0.7;
    ctx.lineWidth = Math.max(2, radius * 0.15);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeText(String(turnsRemaining), tx, ty);
    ctx.fillStyle = TOXIN_CLOUD_COUNTDOWN_COLOR;
    ctx.fillText(String(turnsRemaining), tx, ty);
    ctx.restore();
  }
}
