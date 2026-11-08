import { PLAYER_COLORS } from '../../lib/palette';
import { playSound } from '../../lib/sounds';

export const TANK_RADIUS = 18;
export const TRACK_OFFSET = 9.5;
export const TRACK_HALF_LENGTH = 16;
export const TRACK_WIDTH = 5;
export const TREAD_SPACING = 4;
export const TREAD_WIDTH = 1.2;
export const TURRET_PIVOT = -1;
export const MUZZLE = 20;
export const MARK_LIFE_MS = 5000;
export const EXPLOSION_LIFE_MS = 600;
export const SOUND_GAIN = 0.3;
export const STUCK_TIME = 4;
export const BARRIER_SIZE = 30;
export const MINE_RADIUS = 8;
export const MINE_SPACING = MINE_RADIUS * 2;

const MINE_TRIGGER = 12;
const MINE_EXPLOSION_SIZE = 30;
const SPAWN_ATTEMPTS = 50;
const TANK_EXPLOSION_SIZE = 30;
const SHELL_EXPLOSION_SIZE = 10;
const BLAST_SIZE = 24;
const BARRIER_EXPLOSION_SIZE = 24;

export type TankKind = 'cannon' | 'gun';

export interface Tank {
  kind: TankKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  turn: number;
  timer: number;
  turretAngle: number;
  turretTarget: number;
  reload: number;
  stuckTimer: number;
  anchorX: number;
  anchorY: number;
  escape: { x: number; y: number } | null;
  leftTread: number;
  rightTread: number;
  color: string;
}

export interface Shell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: Tank;
}

export interface Mark {
  x: number;
  y: number;
  cos: number;
  sin: number;
  time: number;
}

export interface Explosion {
  x: number;
  y: number;
  size: number;
  time: number;
  spikes: number[];
}

export interface Mine {
  x: number;
  y: number;
}

export interface World {
  width: number;
  height: number;
  obstacles: DOMRect[];
  tanks: Tank[];
  shells: Shell[];
  marks: Mark[];
  explosions: Explosion[];
  barriers: DOMRect[];
  mines: Mine[];
  spawned: number;
}

export function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function insideRect(
  rect: DOMRect,
  x: number,
  y: number,
  margin: number,
): boolean {
  return (
    x > rect.left - margin &&
    x < rect.right + margin &&
    y > rect.top - margin &&
    y < rect.bottom + margin
  );
}

export function blocked(
  world: World,
  obstacles: DOMRect[],
  x: number,
  y: number,
  margin: number,
): boolean {
  return (
    x < margin ||
    y < margin ||
    x > world.width - margin ||
    y > world.height - margin ||
    obstacles.some((rect) => insideRect(rect, x, y, margin))
  );
}

export function spawnTank(
  world: World,
  x: number,
  y: number,
  kind: TankKind,
  color = PLAYER_COLORS[world.spawned % PLAYER_COLORS.length],
) {
  world.tanks.push({
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: random(0, Math.PI * 2),
    turn: 0,
    timer: 0,
    turretAngle: 0,
    turretTarget: 0,
    reload: random(1, 3),
    stuckTimer: STUCK_TIME,
    anchorX: x,
    anchorY: y,
    escape: null,
    leftTread: 0,
    rightTread: 0,
    color,
  });
  world.spawned += 1;
}

export function spawnMine(
  world: World,
  x: number,
  y: number,
): { x: number; y: number } {
  const center = { x: Math.round(x), y: Math.round(y) };
  const crowded = world.mines.some(
    (mine) =>
      Math.max(Math.abs(mine.x - center.x), Math.abs(mine.y - center.y)) <
      MINE_SPACING,
  );
  if (!crowded) world.mines.push(center);
  return center;
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

export function spawnBarrier(
  world: World,
  x: number,
  y: number,
): { x: number; y: number } {
  const center = { x: Math.round(x), y: Math.round(y) };
  const barrier = new DOMRect(
    center.x - BARRIER_SIZE / 2,
    center.y - BARRIER_SIZE / 2,
    BARRIER_SIZE,
    BARRIER_SIZE,
  );
  if (!world.barriers.some((other) => overlaps(other, barrier))) {
    world.barriers.push(barrier);
  }
  return center;
}

export function extendLine(
  world: World,
  from: { x: number; y: number },
  x: number,
  y: number,
  size: number,
  spawn: (world: World, x: number, y: number) => { x: number; y: number },
): { x: number; y: number } {
  const dx = x - from.x;
  const dy = y - from.y;
  const reach = Math.max(Math.abs(dx), Math.abs(dy));
  let end = from;
  for (let step = size; step <= reach; step += size) {
    end = spawn(
      world,
      from.x + (dx / reach) * step,
      from.y + (dy / reach) * step,
    );
  }
  return end;
}

export function createWorld(
  width: number,
  height: number,
  tankCount: number,
  obstacles: DOMRect[],
): World {
  const world: World = {
    width,
    height,
    obstacles,
    tanks: [],
    shells: [],
    marks: [],
    explosions: [],
    barriers: [],
    mines: [],
    spawned: 0,
  };
  for (let i = 0; i < SPAWN_ATTEMPTS && world.tanks.length < tankCount; i++) {
    const x = random(0, width);
    const y = random(0, height);
    if (!blocked(world, world.obstacles, x, y, TANK_RADIUS)) {
      spawnTank(world, x, y, 'cannon');
    }
  }
  return world;
}

function addExplosion(
  world: World,
  x: number,
  y: number,
  size: number,
  now: number,
) {
  const spikes = Array.from({ length: 10 }, () => random(0.6, 1));
  world.explosions.push({ x, y, size, time: now, spikes });
  playSound('tankExplosion', SOUND_GAIN);
}

export function destroyTank(world: World, tank: Tank, now: number) {
  world.tanks = world.tanks.filter((other) => other !== tank);
  addExplosion(world, tank.x, tank.y, TANK_EXPLOSION_SIZE, now);
}

export function destroyBarrier(world: World, barrier: DOMRect, now: number) {
  world.barriers = world.barriers.filter((other) => other !== barrier);
  addExplosion(
    world,
    barrier.x + barrier.width / 2,
    barrier.y + barrier.height / 2,
    BARRIER_EXPLOSION_SIZE,
    now,
  );
}

export function detonateMines(world: World, now: number) {
  world.mines.forEach((mine) => {
    const tank = world.tanks.find(
      (other) => Math.hypot(other.x - mine.x, other.y - mine.y) < MINE_TRIGGER,
    );
    if (!tank) return;
    world.mines = world.mines.filter((other) => other !== mine);
    addExplosion(world, mine.x, mine.y, MINE_EXPLOSION_SIZE, now);
    destroyTank(world, tank, now);
  });
}

export function shellExplosion(world: World, shell: Shell, now: number) {
  addExplosion(world, shell.x, shell.y, SHELL_EXPLOSION_SIZE, now);
}

export function blast(world: World, x: number, y: number, now: number) {
  addExplosion(world, x, y, BLAST_SIZE, now);
  world.tanks
    .filter((tank) => Math.hypot(tank.x - x, tank.y - y) < BLAST_SIZE)
    .forEach((tank) => destroyTank(world, tank, now));
  world.barriers
    .filter((barrier) => insideRect(barrier, x, y, BLAST_SIZE / 2))
    .forEach((barrier) => destroyBarrier(world, barrier, now));
}

export function clampTanks(world: World) {
  world.tanks.forEach((tank) => {
    tank.x = Math.min(Math.max(tank.x, TANK_RADIUS), world.width - TANK_RADIUS);
    tank.y = Math.min(
      Math.max(tank.y, TANK_RADIUS),
      world.height - TANK_RADIUS,
    );
  });
}
