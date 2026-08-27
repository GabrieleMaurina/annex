import { pseudoRandom } from './state';
import type { ToxinParticlePosition } from './toxin';
import {
  TOXIN_PARTICLE_ALPHA_MIN,
  TOXIN_PARTICLE_ALPHA_RANGE,
  TOXIN_PARTICLE_ORBIT_SPEED_MIN,
  TOXIN_PARTICLE_ORBIT_SPEED_RANGE,
  TOXIN_PARTICLE_RADIUS_MIN,
  TOXIN_PARTICLE_RADIUS_RANGE,
  TOXIN_PARTICLE_REFERENCE_RADIUS,
  TOXIN_PARTICLE_ROTATION_SPEED_MIN,
  TOXIN_PARTICLE_ROTATION_SPEED_RANGE,
  TOXIN_PARTICLE_SIDES,
  TOXIN_PARTICLE_SIZE_MIN,
  TOXIN_PARTICLE_SIZE_RANGE,
} from './toxin';

const RADIATION_CLOUD_SCALE = 1.54;
const RADIATION_COLORS = [
  '#6b6f63',
  '#7d8577',
  '#8a9a82',
  '#5c6b56',
  '#6f9463',
  '#7fae6a',
  '#4a7a3f',
  '#39ff14',
];
const RADIATION_SPEED_SCALE = 0.55;
const RADIATION_ALPHA_SCALE = 0.7;
const RADIATION_UPCOMING_ALPHA_SCALE = 0.3;
const RADIATION_PLACE_BURST_DURATION = 900;
const RADIATION_PARTICLE_COUNT = 9;
const RADIATION_GLOW_BLUR = 7;
const RADIATION_TRAIL_SAMPLES = 3;
const RADIATION_TRAIL_STEP_MS = 55;
const RADIATION_TRAIL_WIDTH = 3;
const RADIATION_TRAIL_ALPHA_SCALE = 0.4;
const RADIATION_SHAKE_STEP_MS = 280;
const RADIATION_SHAKE_RADIUS_AMOUNT = 0.5;
const RADIATION_SHAKE_ANGLE_AMOUNT = 0.7;
const RADIATION_SHAKE_XY_AMOUNT = 0.16;

function radiationColorFor(seed: number, index: number): string {
  const pick = pseudoRandom(seed * 29.71 + index * 3.331);
  return RADIATION_COLORS[Math.floor(pick * RADIATION_COLORS.length)];
}

function radiationJitter(
  now: number,
  seed: number,
  index: number,
  salt: number,
): number {
  const step = Math.floor(now / RADIATION_SHAKE_STEP_MS);
  const t = (now % RADIATION_SHAKE_STEP_MS) / RADIATION_SHAKE_STEP_MS;
  const a = pseudoRandom(seed * 41.7 + index * 6.91 + salt + step) * 2 - 1;
  const b = pseudoRandom(seed * 41.7 + index * 6.91 + salt + step + 1) * 2 - 1;
  return a + (b - a) * t;
}

function radiationParticlePosition(
  now: number,
  seed: number,
  index: number,
  cloudRadius: number,
  expansion: number,
): ToxinParticlePosition {
  const r = (k: number) => pseudoRandom(seed * 17.53 + index * 5.113 + k);

  const orbitSpeed =
    (TOXIN_PARTICLE_ORBIT_SPEED_MIN * RADIATION_SPEED_SCALE +
      r(1) * TOXIN_PARTICLE_ORBIT_SPEED_RANGE * RADIATION_SPEED_SCALE) *
    (r(2) < 0.5 ? 1 : -1);
  const baseAngle =
    (index / RADIATION_PARTICLE_COUNT) * Math.PI * 2 + r(3) * Math.PI * 2;

  const radiusJitter =
    RADIATION_SHAKE_RADIUS_AMOUNT * radiationJitter(now, seed, index, 101);
  const angleJitter =
    RADIATION_SHAKE_ANGLE_AMOUNT * radiationJitter(now, seed, index, 202);
  const angle = baseAngle + now * orbitSpeed + angleJitter;

  const baseRadiusFrac =
    TOXIN_PARTICLE_RADIUS_MIN + r(8) * TOXIN_PARTICLE_RADIUS_RANGE;
  const radiusFrac = Math.min(1, Math.max(0.05, baseRadiusFrac + radiusJitter));

  const dist = cloudRadius * radiusFrac * expansion;
  const shakeX =
    cloudRadius *
    RADIATION_SHAKE_XY_AMOUNT *
    radiationJitter(now, seed, index, 303);
  const shakeY =
    cloudRadius *
    RADIATION_SHAKE_XY_AMOUNT *
    radiationJitter(now, seed, index, 404);

  const rotationSpeed =
    (TOXIN_PARTICLE_ROTATION_SPEED_MIN +
      r(9) * TOXIN_PARTICLE_ROTATION_SPEED_RANGE) *
    RADIATION_SPEED_SCALE *
    (r(10) < 0.5 ? 1 : -1);
  const rotationPhase = r(11) * Math.PI * 2;

  return {
    x: Math.cos(angle) * dist + shakeX,
    y: Math.sin(angle) * dist + shakeY,
    size: TOXIN_PARTICLE_SIZE_MIN + r(12) * TOXIN_PARTICLE_SIZE_RANGE,
    alpha: TOXIN_PARTICLE_ALPHA_MIN + r(13) * TOXIN_PARTICLE_ALPHA_RANGE,
    rotation: now * rotationSpeed + rotationPhase,
  };
}

function drawRadiationParticle(
  ctx: CanvasRenderingContext2D,
  particle: ToxinParticlePosition,
  sizeScale: number,
  alphaScale: number,
  color: string,
) {
  const size = Math.max(0.5, particle.size * sizeScale);
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.shadowBlur = RADIATION_GLOW_BLUR * sizeScale;
  ctx.shadowColor = color;
  ctx.beginPath();
  for (let i = 0; i < TOXIN_PARTICLE_SIDES; i++) {
    const angle = (i / TOXIN_PARTICLE_SIDES) * Math.PI * 2;
    const px = Math.cos(angle) * size;
    const py = Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.globalAlpha = Math.min(1, particle.alpha * alphaScale);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawRadiationTrail(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  sizeScale: number,
  alphaScale: number,
  color: string,
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, RADIATION_TRAIL_WIDTH * sizeScale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = alphaScale * RADIATION_TRAIL_ALPHA_SCALE;
  ctx.stroke();
  ctx.restore();
}

export function drawRadiationCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  now: number,
  isUpcoming: boolean,
  seed: number,
  placedAt: number,
) {
  const cloudRadius = radius * RADIATION_CLOUD_SCALE;
  const sizeScale = radius / TOXIN_PARTICLE_REFERENCE_RADIUS;
  const alphaScale =
    (isUpcoming ? RADIATION_UPCOMING_ALPHA_SCALE : 1) * RADIATION_ALPHA_SCALE;
  const burstProgress = Math.min(
    1,
    Math.max(0, (now - placedAt) / RADIATION_PLACE_BURST_DURATION),
  );
  const expansion = isUpcoming ? 1 : 1 - (1 - burstProgress) ** 3;

  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < RADIATION_PARTICLE_COUNT; i++) {
    const color = radiationColorFor(seed, i);
    const trailPoints: ToxinParticlePosition[] = [];
    for (let k = RADIATION_TRAIL_SAMPLES - 1; k >= 0; k--) {
      trailPoints.push(
        radiationParticlePosition(
          now - k * RADIATION_TRAIL_STEP_MS,
          seed,
          i,
          cloudRadius,
          expansion,
        ),
      );
    }
    drawRadiationTrail(ctx, trailPoints, sizeScale, alphaScale, color);
    drawRadiationParticle(
      ctx,
      trailPoints[trailPoints.length - 1],
      sizeScale,
      alphaScale,
      color,
    );
  }
  ctx.restore();
}
