import { PLAYER_COLORS } from '../../lib/palette';
import type { Explosion, Mark, Shell, Tank, World } from './world';
import {
  EXPLOSION_LIFE_MS,
  MARK_LIFE_MS,
  MUZZLE,
  TRACK_HALF_LENGTH,
  TRACK_OFFSET,
  TRACK_WIDTH,
  TREAD_SPACING,
  TREAD_WIDTH,
  TURRET_PIVOT,
} from './world';

type Point = [number, number];

const HULL: Point[] = [
  [-13, -8],
  [11, -8],
  [14, -5],
  [14, 5],
  [11, 8],
  [-13, 8],
];
const DECK: Point[] = [
  [-10, -5],
  [9, -5],
  [11, -2],
  [11, 2],
  [9, 5],
  [-10, 5],
];
const SHELL: Point[] = [
  [3, 0],
  [0, 1.5],
  [-3, 0],
  [0, -1.5],
];
const TURRET_RADIUS = 6;
const TURRET_SHADES = [1.25, 1.1, 0.95, 0.85, 0.95, 1.1];
const TRACK_COLOR = '#262626';
const TREAD_COLOR = '#4a4a4a';
const SHELL_COLOR = PLAYER_COLORS[3];
const EXPLOSION_LAYERS: [number, string][] = [
  [1, PLAYER_COLORS[5]],
  [0.55, PLAYER_COLORS[3]],
];
const MARK_ALPHA = 0.18;
const MARK_LEVELS = 10;
const MARK_COLOR = '#ffffff';

const TURRET_TRIANGLES: Point[][] = TURRET_SHADES.map((_, i) => {
  const a = (i * Math.PI) / 3;
  const b = ((i + 1) * Math.PI) / 3;
  return [
    [0, 0],
    [Math.cos(a) * TURRET_RADIUS, Math.sin(a) * TURRET_RADIUS],
    [Math.cos(b) * TURRET_RADIUS, Math.sin(b) * TURRET_RADIUS],
  ];
});

interface TankPaint {
  hull: string;
  deck: string;
  barrel: string;
  turret: string[];
}

const tankPaints = new Map<string, TankPaint>();

function shade(hex: string, factor: number): string {
  const channel = (start: number) =>
    Math.min(
      255,
      Math.round(parseInt(hex.slice(start, start + 2), 16) * factor),
    );
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}

function tankPaint(color: string): TankPaint {
  let paint = tankPaints.get(color);
  if (!paint) {
    paint = {
      hull: shade(color, 0.75),
      deck: color,
      barrel: shade(color, 0.5),
      turret: TURRET_SHADES.map((factor) => shade(color, factor)),
    };
    tankPaints.set(color, paint);
  }
  return paint;
}

function polygon(ctx: CanvasRenderingContext2D, points: Point[], fill: string) {
  ctx.beginPath();
  points.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawTrack(
  ctx: CanvasRenderingContext2D,
  offset: number,
  tread: number,
) {
  const top = offset - TRACK_WIDTH / 2;
  ctx.fillStyle = TRACK_COLOR;
  ctx.fillRect(-TRACK_HALF_LENGTH, top, TRACK_HALF_LENGTH * 2, TRACK_WIDTH);
  ctx.fillStyle = TREAD_COLOR;
  const start =
    -TRACK_HALF_LENGTH +
    (((-tread % TREAD_SPACING) + TREAD_SPACING) % TREAD_SPACING);
  for (let x = start; x < TRACK_HALF_LENGTH; x += TREAD_SPACING) {
    const width = Math.min(TREAD_WIDTH, TRACK_HALF_LENGTH - x);
    ctx.fillRect(x, top, width, TRACK_WIDTH);
  }
}

function drawTank(ctx: CanvasRenderingContext2D, tank: Tank) {
  const paint = tankPaint(tank.color);
  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.rotate(tank.angle);
  drawTrack(ctx, -TRACK_OFFSET, tank.leftTread);
  drawTrack(ctx, TRACK_OFFSET, tank.rightTread);
  polygon(ctx, HULL, paint.hull);
  polygon(ctx, DECK, paint.deck);

  ctx.translate(TURRET_PIVOT, 0);
  ctx.rotate(tank.turretAngle);
  ctx.fillStyle = paint.barrel;
  ctx.fillRect(3, -1.5, MUZZLE - 3, 3);
  TURRET_TRIANGLES.forEach((triangle, i) =>
    polygon(ctx, triangle, paint.turret[i]),
  );
  ctx.restore();
}

function markPath(ctx: CanvasRenderingContext2D, mark: Mark) {
  const ax = (mark.cos * TREAD_WIDTH) / 2;
  const ay = (mark.sin * TREAD_WIDTH) / 2;
  const bx = (-mark.sin * TRACK_WIDTH) / 2;
  const by = (mark.cos * TRACK_WIDTH) / 2;
  ctx.moveTo(mark.x - ax - bx, mark.y - ay - by);
  ctx.lineTo(mark.x + ax - bx, mark.y + ay - by);
  ctx.lineTo(mark.x + ax + bx, mark.y + ay + by);
  ctx.lineTo(mark.x - ax + bx, mark.y - ay + by);
  ctx.closePath();
}

function drawMarks(ctx: CanvasRenderingContext2D, marks: Mark[], now: number) {
  ctx.fillStyle = MARK_COLOR;
  ctx.beginPath();
  let level = -1;
  marks.forEach((mark) => {
    const life = 1 - (now - mark.time) / MARK_LIFE_MS;
    const markLevel = Math.ceil(life * MARK_LEVELS);
    if (markLevel !== level) {
      ctx.fill();
      ctx.beginPath();
      ctx.globalAlpha = (MARK_ALPHA * markLevel) / MARK_LEVELS;
      level = markLevel;
    }
    markPath(ctx, mark);
  });
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawShell(ctx: CanvasRenderingContext2D, shell: Shell) {
  ctx.save();
  ctx.translate(shell.x, shell.y);
  ctx.rotate(Math.atan2(shell.vy, shell.vx));
  polygon(ctx, SHELL, SHELL_COLOR);
  ctx.restore();
}

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  explosion: Explosion,
  now: number,
) {
  const progress = (now - explosion.time) / EXPLOSION_LIFE_MS;
  const radius = explosion.size * (0.4 + 0.6 * progress);
  const count = explosion.spikes.length;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.translate(explosion.x, explosion.y);
  EXPLOSION_LAYERS.forEach(([scale, color]) => {
    const points = explosion.spikes.map((spike, i): Point => {
      const angle = (i / count) * Math.PI * 2;
      const length = radius * scale * spike;
      return [Math.cos(angle) * length, Math.sin(angle) * length];
    });
    polygon(ctx, points, color);
  });
  ctx.restore();
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  now: number,
) {
  ctx.clearRect(0, 0, world.width, world.height);
  drawMarks(ctx, world.marks, now);
  world.tanks.forEach((tank) => drawTank(ctx, tank));
  world.shells.forEach((shell) => drawShell(ctx, shell));
  world.explosions.forEach((explosion) => drawExplosion(ctx, explosion, now));
}
