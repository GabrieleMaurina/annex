import type { Animation, Particle } from '../state';
import { DURATIONS, pseudoRandom } from '../state';

const GREENS = ['#5ec27a', '#3f9d5c', '#9be08f', '#2f6b4f'];
const MIST_RGB = '94, 194, 122';
const SHOCK_RGB = '47, 107, 79';
const FLASH_RGB = '155, 224, 143';
const REFERENCE_RADIUS = 20;
const SPAWN_PARTICLES = 12;
const INFECT_PARTICLES = 14;
const VEIN_SEGMENTS = 3;

export function makeZombieParticles(type: 'spawn' | 'infect'): Particle[] {
  const infect = type === 'infect';
  const count = infect ? INFECT_PARTICLES : SPAWN_PARTICLES;
  return Array.from({ length: count }, (_, i) => ({
    angle: infect
      ? (i / count) * Math.PI * 2 + Math.random() * 0.4
      : -Math.PI / 2 + (Math.random() - 0.5) * 1.4,
    speed: infect ? 16 + Math.random() * 16 : 10 + Math.random() * 16,
    size: 2 + Math.random() * 3.5,
    color: GREENS[Math.floor(Math.random() * GREENS.length)],
    kind: 'dust',
  }));
}

export function drawSpawn(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  now: number,
) {
  const progress = Math.min(1, (now - a.startedAt) / DURATIONS.spawn);
  const scale = radius / REFERENCE_RADIUS;
  const glowRadius = radius * (1.1 + progress * 0.9);

  ctx.save();
  const glow = ctx.createRadialGradient(
    p.x,
    p.y,
    radius * 0.2,
    p.x,
    p.y,
    glowRadius,
  );
  glow.addColorStop(0, `rgba(${MIST_RGB}, ${0.5 * (1 - progress)})`);
  glow.addColorStop(1, `rgba(${MIST_RGB}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1 - progress;
  for (const particle of a.particles ?? []) {
    const distance = particle.speed * progress * scale;
    const px = p.x + Math.cos(particle.angle) * distance * 0.6;
    const py = p.y + Math.sin(particle.angle) * distance;
    ctx.beginPath();
    ctx.arc(
      px,
      py,
      Math.max(0.5, particle.size * scale * (1 - progress * 0.5)),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = particle.color ?? GREENS[0];
    ctx.fill();
  }
  ctx.restore();
}

export function drawInfect(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  p: { x: number; y: number },
  radius: number,
  now: number,
) {
  const progress = Math.min(1, (now - a.startedAt) / DURATIONS.infect);
  const scale = radius / REFERENCE_RADIUS;
  const ringProgress = Math.min(1, progress / 0.7);

  ctx.save();
  const flashAlpha = Math.max(0, 1 - progress * 2.5);
  if (flashAlpha > 0) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${FLASH_RGB}, ${flashAlpha * 0.7})`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * (0.5 + ringProgress * 1.6), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${SHOCK_RGB}, ${(1 - ringProgress) * 0.9})`;
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  ctx.stroke();

  const reach = 1 - (1 - progress) * (1 - progress);
  ctx.strokeStyle = `rgba(${MIST_RGB}, ${1 - progress})`;
  ctx.lineWidth = Math.max(1, 1.6 * scale);
  (a.particles ?? []).forEach((particle, index) => {
    const length = particle.speed * scale * reach * 1.6;
    const cos = Math.cos(particle.angle);
    const sin = Math.sin(particle.angle);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    for (let step = 1; step <= VEIN_SEGMENTS; step++) {
      const along = (length * step) / VEIN_SEGMENTS;
      const offset =
        (pseudoRandom(index * 7.1 + step) - 0.5) * 4 * scale * (step / 2);
      ctx.lineTo(
        p.x + cos * along - sin * offset,
        p.y + sin * along + cos * offset,
      );
    }
    ctx.stroke();
  });
  ctx.restore();
}
