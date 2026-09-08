import { drawExplosion } from './explosion';
import type { Animation } from './state';
import { NUKE_FLIGHT_MS, NUKE_MUSHROOM_MS, pseudoRandom } from './state';

const INTERCEPT_MEET = 0.55;
const INTERCEPT_REACTION = 0.15;
const INTERCEPT_BLAST_SCALE = 1;
const DEBRIS_BLAST_SCALE = 1.4;

type Point = { x: number; y: number };

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function arcHeight(from: Point, to: Point, radius: number): number {
  return Math.max(radius * 5, Math.hypot(to.x - from.x, to.y - from.y) * 0.28);
}

function parabolaPos(from: Point, to: Point, arc: number, t: number): Point {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t - arc * 4 * t * (1 - t),
  };
}

function parabolaHeading(
  from: Point,
  to: Point,
  arc: number,
  t: number,
): number {
  return Math.atan2(to.y - from.y - arc * 4 * (1 - 2 * t), to.x - from.x);
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = 'rgba(228, 228, 233, 0.32)';
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawRocket(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  angle: number,
  radius: number,
  scale: number,
  now: number,
) {
  const l = radius * 2.8 * scale;
  const w = radius * 0.92 * scale;
  const half = l / 2;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);

  const flicker = 0.7 + 0.3 * Math.sin(now / 45 + pos.x * 0.3);
  const flameLen = l * (0.85 + 0.6 * flicker);
  const flame = ctx.createLinearGradient(-half, 0, -half - flameLen, 0);
  flame.addColorStop(0, 'rgba(255, 232, 150, 0.95)');
  flame.addColorStop(0.35, 'rgba(255, 150, 45, 0.85)');
  flame.addColorStop(1, 'rgba(255, 80, 20, 0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-half, -w * 0.4);
  ctx.lineTo(-half - flameLen, 0);
  ctx.lineTo(-half, w * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#9aa0a6';
  ctx.beginPath();
  ctx.moveTo(-half, -w * 0.5);
  ctx.lineTo(-half - l * 0.14, -w * 1.0);
  ctx.lineTo(-half + l * 0.2, -w * 0.5);
  ctx.closePath();
  ctx.moveTo(-half, w * 0.5);
  ctx.lineTo(-half - l * 0.14, w * 1.0);
  ctx.lineTo(-half + l * 0.2, w * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#dfe1e4';
  ctx.beginPath();
  ctx.moveTo(-half, -w * 0.5);
  ctx.lineTo(half - l * 0.28, -w * 0.5);
  ctx.quadraticCurveTo(half, -w * 0.5, half, 0);
  ctx.quadraticCurveTo(half, w * 0.5, half - l * 0.28, w * 0.5);
  ctx.lineTo(-half, w * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(half - l * 0.22, -w * 0.5);
  ctx.quadraticCurveTo(half, -w * 0.5, half, 0);
  ctx.quadraticCurveTo(half, w * 0.5, half - l * 0.22, w * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#5aa9d6';
  ctx.beginPath();
  ctx.arc(l * 0.02, 0, w * 0.17, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMushroom(
  ctx: CanvasRenderingContext2D,
  ground: Point,
  radius: number,
  elapsed: number,
  seed: number,
) {
  const mt = elapsed / NUKE_MUSHROOM_MS;
  if (mt >= 1) return;
  const fade = mt < 0.7 ? 1 : Math.max(0, (1 - mt) / 0.3);
  const grow = easeOut(Math.min(1, mt * 1.2));
  const rise = radius * 6 * grow;
  const capY = ground.y - rise;

  ctx.save();

  if (mt < 0.14) {
    const flash = 1 - mt / 0.14;
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(
      ground.x,
      ground.y - radius * 0.4,
      radius * (2 + 3 * (1 - flash)),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = `rgba(96, 98, 102, ${0.32 * fade})`;
  lobedBlob(
    ctx,
    ground.x,
    ground.y,
    radius * (1.1 + 4 * grow),
    0.32,
    9,
    seed + 50,
  );
  ctx.fill();

  const stemTopY = ground.y - rise * 0.68;
  const baseHalf = radius * (0.9 + 0.7 * grow);
  const topHalf = radius * (0.5 + 0.4 * grow);
  const midY = (ground.y + stemTopY) / 2;
  const stemGrad = ctx.createLinearGradient(0, ground.y, 0, stemTopY);
  stemGrad.addColorStop(0, `rgba(255, 140, 40, ${0.85 * fade})`);
  stemGrad.addColorStop(0.45, `rgba(200, 110, 70, ${0.7 * fade})`);
  stemGrad.addColorStop(1, `rgba(120, 122, 126, ${0.72 * fade})`);
  ctx.fillStyle = stemGrad;
  ctx.beginPath();
  ctx.moveTo(ground.x - baseHalf, ground.y);
  ctx.quadraticCurveTo(
    ground.x - topHalf * 1.4,
    midY,
    ground.x - topHalf,
    stemTopY,
  );
  ctx.lineTo(ground.x + topHalf, stemTopY);
  ctx.quadraticCurveTo(
    ground.x + topHalf * 1.4,
    midY,
    ground.x + baseHalf,
    ground.y,
  );
  ctx.closePath();
  ctx.fill();

  if (mt < 0.45) {
    ctx.globalAlpha = (1 - mt / 0.45) * fade;
    ctx.fillStyle = '#ffcf7a';
    lobedBlob(
      ctx,
      ground.x,
      ground.y - radius * 0.5,
      radius * (1.5 - mt),
      0.9,
      7,
      seed + 11,
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const capR = radius * (1 + 3.4 * grow);
  ctx.fillStyle = `rgba(74, 76, 80, ${0.5 * fade})`;
  lobedBlob(ctx, ground.x, capY, capR * 1.08, 0.66, 8, seed + 3);
  ctx.fill();
  ctx.fillStyle = `rgba(116, 118, 122, ${0.62 * fade})`;
  lobedBlob(ctx, ground.x, capY - radius * 0.2, capR * 0.82, 0.62, 8, seed + 7);
  ctx.fill();
  if (mt < 0.55) {
    ctx.globalAlpha = (0.55 - mt) * 1.6 * fade;
    ctx.fillStyle = '#ff8a2c';
    lobedBlob(
      ctx,
      ground.x,
      capY + radius * 0.15,
      capR * 0.5,
      0.6,
      7,
      seed + 9,
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function lobedBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  squash: number,
  sides: number,
  seed: number,
) {
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const wobble = 0.68 + 0.5 * pseudoRandom(seed + i * 2.13);
    const px = cx + Math.cos(angle) * r * wobble;
    const py = cy + Math.sin(angle) * r * wobble * squash;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function trailPoints(sample: (t: number) => Point, from: number, to: number) {
  const points: Point[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++)
    points.push(sample(from + (to - from) * (i / steps)));
  return points;
}

export function drawNuke(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  toScreen: (p: Point) => Point,
  radius: number,
  now: number,
) {
  const elapsed = now - a.startedAt;
  const from = toScreen({ x: a.fromX ?? a.x, y: a.fromY ?? a.y });
  const target = toScreen({ x: a.x, y: a.y });
  const arc = arcHeight(from, target, radius);
  const flight = Math.min(1, elapsed / NUKE_FLIGHT_MS);
  const endT = a.intercepted ? INTERCEPT_MEET : 1;
  const blastPoint = parabolaPos(from, target, arc, endT);

  if (flight < 1) {
    const nukeT = flight * endT;
    const nukePos = parabolaPos(from, target, arc, nukeT);
    drawTrail(
      ctx,
      trailPoints(
        (t) => parabolaPos(from, target, arc, t),
        Math.max(0, nukeT - 0.4),
        nukeT,
      ),
      Math.max(1, radius * 0.32),
    );
    drawRocket(
      ctx,
      nukePos,
      parabolaHeading(from, target, arc, nukeT),
      radius,
      1,
      now,
    );

    if (a.intercepted && a.interceptFromX !== undefined) {
      const interceptFrom = toScreen({
        x: a.interceptFromX,
        y: a.interceptFromY ?? a.y,
      });
      const it = Math.max(
        0,
        (flight - INTERCEPT_REACTION) / (1 - INTERCEPT_REACTION),
      );
      const interceptorPos = lerp(interceptFrom, blastPoint, it);
      drawTrail(
        ctx,
        [
          lerp(interceptFrom, blastPoint, Math.max(0, it - 0.5)),
          interceptorPos,
        ],
        Math.max(1, radius * 0.18),
      );
      drawRocket(
        ctx,
        interceptorPos,
        Math.atan2(
          blastPoint.y - interceptFrom.y,
          blastPoint.x - interceptFrom.x,
        ),
        radius,
        0.5,
        now,
      );
    }
    return;
  }

  const explosionA = { ...a, startedAt: a.startedAt + NUKE_FLIGHT_MS };
  if (a.intercepted) {
    drawExplosion(
      ctx,
      explosionA,
      blastPoint,
      radius * INTERCEPT_BLAST_SCALE,
      now,
    );
    return;
  }
  drawExplosion(ctx, explosionA, blastPoint, radius * DEBRIS_BLAST_SCALE, now);
  drawMushroom(
    ctx,
    blastPoint,
    radius,
    elapsed - NUKE_FLIGHT_MS,
    a.x * 0.7 + a.y * 1.3,
  );
}
