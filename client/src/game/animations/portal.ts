import { jaggedPolygonPath, pseudoRandom } from './state';

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
