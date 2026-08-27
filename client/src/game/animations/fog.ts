import { pseudoRandom } from './state';

const FOG_CLOUD_SCALE = 1.38;
const FOG_SPREAD_SCALE = 2.4;
const FOG_COLOR = '223, 227, 230';
const FOG_BLOB_COLORS = [
  '150, 155, 160',
  '182, 187, 191',
  '204, 208, 212',
  '223, 227, 230',
  '238, 240, 242',
];
const FOG_BASE_ALPHA = 0.9;
const FOG_BLOB_ALPHA = 0.55;
const FOG_BLOB_COUNT = 6;
const FOG_BLOB_SIZE_MIN = 0.66;
const FOG_BLOB_SIZE_RANGE = 0.42;
const FOG_BLOB_DIST_MIN = 0.35;
const FOG_BLOB_DIST_RANGE = 0.3;
const FOG_MEDIUM_BLOB_COUNT = 7;
const FOG_MEDIUM_BLOB_SIZE_MIN = 0.48;
const FOG_MEDIUM_BLOB_SIZE_RANGE = 0.3;
const FOG_MEDIUM_BLOB_DIST_MIN = 0.5;
const FOG_MEDIUM_BLOB_DIST_RANGE = 0.4;
const FOG_DRIFT_SPEED_MIN = 0.0001;
const FOG_DRIFT_SPEED_RANGE = 0.00025;
const FOG_DRIFT_ANGLE_AMOUNT = 0.6;
const FOG_DRIFT_SIZE_AMOUNT = 0.18;
const FOG_BASE_SWAY_AMOUNT = 0.15;

function drawFogBlobs(
  ctx: CanvasRenderingContext2D,
  now: number,
  seed: number,
  seedSalt: number,
  cloudRadius: number,
  spreadRadius: number,
  count: number,
  sizeMin: number,
  sizeRange: number,
  distMin: number,
  distRange: number,
) {
  for (let i = 0; i < count; i++) {
    const r = (k: number) => pseudoRandom(seed * seedSalt + i * 3.271 + k);
    const driftSpeed = FOG_DRIFT_SPEED_MIN + r(1) * FOG_DRIFT_SPEED_RANGE;
    const driftPhase = r(2) * Math.PI * 2;
    const drift = Math.sin(now * driftSpeed + driftPhase);
    const angle = (i / count) * Math.PI * 2 + drift * FOG_DRIFT_ANGLE_AMOUNT;
    const dist = spreadRadius * (distMin + r(3) * distRange);
    const blobRadius =
      cloudRadius *
      (sizeMin + r(4) * sizeRange) *
      (1 + drift * FOG_DRIFT_SIZE_AMOUNT);
    const color = FOG_BLOB_COLORS[Math.floor(r(5) * FOG_BLOB_COLORS.length)];
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * dist,
      Math.sin(angle) * dist,
      blobRadius,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgb(${color})`;
    ctx.fill();
  }
}

export function drawFogCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  now: number,
  seed: number,
) {
  const cloudRadius = radius * FOG_CLOUD_SCALE;
  const spreadRadius = radius * FOG_SPREAD_SCALE;

  ctx.save();
  ctx.translate(x, y);

  const r = (k: number) => pseudoRandom(seed * 4.657 + k);
  const baseDriftSpeed = FOG_DRIFT_SPEED_MIN + r(1) * FOG_DRIFT_SPEED_RANGE;
  const baseDriftPhase = r(2) * Math.PI * 2;
  const baseDrift = Math.sin(now * baseDriftSpeed + baseDriftPhase);
  const baseSwayAngle = r(3) * Math.PI * 2;
  const baseSwayDist = cloudRadius * FOG_BASE_SWAY_AMOUNT * baseDrift;
  const baseX = Math.cos(baseSwayAngle) * baseSwayDist;
  const baseY = Math.sin(baseSwayAngle) * baseSwayDist;
  const baseRadius = cloudRadius * (1 + baseDrift * FOG_DRIFT_SIZE_AMOUNT);

  ctx.globalAlpha = FOG_BASE_ALPHA;
  ctx.fillStyle = `rgb(${FOG_COLOR})`;
  ctx.beginPath();
  ctx.arc(baseX, baseY, baseRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = FOG_BLOB_ALPHA;
  drawFogBlobs(
    ctx,
    now,
    seed,
    7.919,
    cloudRadius,
    spreadRadius,
    FOG_BLOB_COUNT,
    FOG_BLOB_SIZE_MIN,
    FOG_BLOB_SIZE_RANGE,
    FOG_BLOB_DIST_MIN,
    FOG_BLOB_DIST_RANGE,
  );
  drawFogBlobs(
    ctx,
    now,
    seed,
    13.463,
    cloudRadius,
    spreadRadius,
    FOG_MEDIUM_BLOB_COUNT,
    FOG_MEDIUM_BLOB_SIZE_MIN,
    FOG_MEDIUM_BLOB_SIZE_RANGE,
    FOG_MEDIUM_BLOB_DIST_MIN,
    FOG_MEDIUM_BLOB_DIST_RANGE,
  );

  ctx.restore();
}
