import { pseudoRandom } from './state';

const FOG_CLOUD_SCALE = 1.38;
const FOG_SPREAD_SCALE = 2.4;
const FOG_FILL_STYLE = 'rgb(223, 227, 230)';
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

interface FogBlob {
  driftSpeed: number;
  driftPhase: number;
  baseAngle: number;
  distFraction: number;
  sizeFraction: number;
  fillStyle: string;
}

interface FogStyle {
  driftSpeed: number;
  driftPhase: number;
  swayX: number;
  swayY: number;
  blobs: FogBlob[];
}

const fogStyles = new Map<number, FogStyle>();

function fogBlobs(
  seed: number,
  seedSalt: number,
  count: number,
  sizeMin: number,
  sizeRange: number,
  distMin: number,
  distRange: number,
): FogBlob[] {
  return Array.from({ length: count }, (_, i) => {
    const r = (k: number) => pseudoRandom(seed * seedSalt + i * 3.271 + k);
    const color = FOG_BLOB_COLORS[Math.floor(r(5) * FOG_BLOB_COLORS.length)];
    return {
      driftSpeed: FOG_DRIFT_SPEED_MIN + r(1) * FOG_DRIFT_SPEED_RANGE,
      driftPhase: r(2) * Math.PI * 2,
      baseAngle: (i / count) * Math.PI * 2,
      distFraction: distMin + r(3) * distRange,
      sizeFraction: sizeMin + r(4) * sizeRange,
      fillStyle: `rgb(${color})`,
    };
  });
}

function fogStyle(seed: number): FogStyle {
  const cached = fogStyles.get(seed);
  if (cached) return cached;
  const r = (k: number) => pseudoRandom(seed * 4.657 + k);
  const swayAngle = r(3) * Math.PI * 2;
  const style = {
    driftSpeed: FOG_DRIFT_SPEED_MIN + r(1) * FOG_DRIFT_SPEED_RANGE,
    driftPhase: r(2) * Math.PI * 2,
    swayX: Math.cos(swayAngle),
    swayY: Math.sin(swayAngle),
    blobs: [
      ...fogBlobs(
        seed,
        7.919,
        FOG_BLOB_COUNT,
        FOG_BLOB_SIZE_MIN,
        FOG_BLOB_SIZE_RANGE,
        FOG_BLOB_DIST_MIN,
        FOG_BLOB_DIST_RANGE,
      ),
      ...fogBlobs(
        seed,
        13.463,
        FOG_MEDIUM_BLOB_COUNT,
        FOG_MEDIUM_BLOB_SIZE_MIN,
        FOG_MEDIUM_BLOB_SIZE_RANGE,
        FOG_MEDIUM_BLOB_DIST_MIN,
        FOG_MEDIUM_BLOB_DIST_RANGE,
      ),
    ],
  };
  fogStyles.set(seed, style);
  return style;
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
  const style = fogStyle(seed);

  ctx.save();
  ctx.translate(x, y);

  const baseDrift = Math.sin(now * style.driftSpeed + style.driftPhase);
  const baseSwayDist = cloudRadius * FOG_BASE_SWAY_AMOUNT * baseDrift;
  const baseRadius = cloudRadius * (1 + baseDrift * FOG_DRIFT_SIZE_AMOUNT);

  ctx.globalAlpha = FOG_BASE_ALPHA;
  ctx.fillStyle = FOG_FILL_STYLE;
  ctx.beginPath();
  ctx.arc(
    style.swayX * baseSwayDist,
    style.swayY * baseSwayDist,
    baseRadius,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.globalAlpha = FOG_BLOB_ALPHA;
  for (const blob of style.blobs) {
    const drift = Math.sin(now * blob.driftSpeed + blob.driftPhase);
    const angle = blob.baseAngle + drift * FOG_DRIFT_ANGLE_AMOUNT;
    const dist = spreadRadius * blob.distFraction;
    const blobRadius =
      cloudRadius * blob.sizeFraction * (1 + drift * FOG_DRIFT_SIZE_AMOUNT);
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * dist,
      Math.sin(angle) * dist,
      blobRadius,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = blob.fillStyle;
    ctx.fill();
  }

  ctx.restore();
}
