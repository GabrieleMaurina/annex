import type { Animation, Particle } from './state';
import { DURATIONS } from './state';

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

export function makeEntrenchParticles(): Particle[] {
  return Array.from({ length: ENTRENCH_PARTICLE_COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: 8 + Math.random() * 18,
    size: 3 + Math.random() * 4,
    color: DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)],
    kind: 'dust',
  }));
}

export function drawEntrench(
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
