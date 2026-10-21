import { playSound } from '../../lib/sounds';
import type { Tank, World } from './world';
import {
  EXPLOSION_LIFE_MS,
  MARK_LIFE_MS,
  MUZZLE,
  SOUND_GAIN,
  STUCK_TIME,
  TANK_RADIUS,
  TRACK_HALF_LENGTH,
  TRACK_OFFSET,
  TREAD_SPACING,
  TREAD_WIDTH,
  TURRET_PIVOT,
  blocked,
  destroyTank,
  insideRect,
  random,
  shellExplosion,
} from './world';

const SPEED = 40;
const TURN_RATE = 0.9;
const TURRET_RATE = 0.8;
const AIM_RATE = 2.5;
const LOOKAHEAD = 45;
const PROBE_ANGLE = 0.5;
const AVOID_TIME = 0.5;
const SIGHT = 280;
const SHELL_SPEED = 220;
const SHELL_RADIUS = 2;
const AIM_TOLERANCE = 0.03;
const AIM_NOISE = 0.07;
const STUCK_DISTANCE = 10;
const ESCAPE_STEP = 15;
const ESCAPE_DIRECTIONS = 16;
const PIVOT_ANGLE = 0.5;
const RELOAD_MIN = 1.5;
const RELOAD_MAX = 3;
const HIT_RADIUS = 12;

interface Point {
  x: number;
  y: number;
}

function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function chooseAction(tank: Tank) {
  tank.turn = [0, 0, -TURN_RATE, TURN_RATE][Math.floor(Math.random() * 4)];
  tank.timer = tank.turn === 0 ? random(1, 4) : random(0.6, 1.8);
  tank.turretTarget = random(-1.2, 1.2);
}

function avoidObstacles(tank: Tank, world: World, obstacles: DOMRect[]) {
  const probe = (offset: number) =>
    blocked(
      world,
      obstacles,
      tank.x + Math.cos(tank.angle + offset) * LOOKAHEAD,
      tank.y + Math.sin(tank.angle + offset) * LOOKAHEAD,
      TANK_RADIUS,
    );
  if (!probe(0)) return;
  const left = probe(-PROBE_ANGLE);
  const right = probe(PROBE_ANGLE);
  const direction = left === right ? Math.sign(tank.turn) || 1 : left ? 1 : -1;
  tank.turn = direction * TURN_RATE;
  tank.timer = AVOID_TIME;
}

function stampTreads(
  world: World,
  tank: Tank,
  offset: number,
  from: number,
  to: number,
  now: number,
) {
  const stripes: number[] = [];
  for (let n = Math.ceil(from / TREAD_SPACING); n * TREAD_SPACING < to; n++) {
    stripes.push(-TRACK_HALF_LENGTH - (to - n * TREAD_SPACING));
  }
  for (
    let n = Math.ceil(from / TREAD_SPACING) - 1;
    n * TREAD_SPACING >= to;
    n--
  ) {
    stripes.push(TRACK_HALF_LENGTH + (n * TREAD_SPACING - to));
  }
  const cos = Math.cos(tank.angle);
  const sin = Math.sin(tank.angle);
  stripes.forEach((stripe) => {
    const x = stripe + TREAD_WIDTH / 2;
    world.marks.push({
      x: tank.x + x * cos - offset * sin,
      y: tank.y + x * sin + offset * cos,
      cos,
      sin,
      time: now,
    });
  });
}

function drive(
  tank: Tank,
  world: World,
  obstacles: DOMRect[],
  dt: number,
  now: number,
  forward: boolean,
) {
  const step = SPEED * dt;
  tank.angle += tank.turn * dt;
  const free =
    forward &&
    !blocked(
      world,
      obstacles,
      tank.x + Math.cos(tank.angle) * step,
      tank.y + Math.sin(tank.angle) * step,
      TANK_RADIUS,
    );
  if (!free && tank.turn === 0) tank.turn = TURN_RATE;
  const speed = free ? SPEED : 0;
  tank.vx = Math.cos(tank.angle) * speed;
  tank.vy = Math.sin(tank.angle) * speed;
  tank.x += tank.vx * dt;
  tank.y += tank.vy * dt;
  const left = tank.leftTread + (speed + tank.turn * TRACK_OFFSET) * dt;
  const right = tank.rightTread + (speed - tank.turn * TRACK_OFFSET) * dt;
  stampTreads(world, tank, -TRACK_OFFSET, tank.leftTread, left, now);
  stampTreads(world, tank, TRACK_OFFSET, tank.rightTread, right, now);
  tank.leftTread = left;
  tank.rightTread = right;
}

function turretPivot(tank: Tank): Point {
  return {
    x: tank.x + Math.cos(tank.angle) * TURRET_PIVOT,
    y: tank.y + Math.sin(tank.angle) * TURRET_PIVOT,
  };
}

function intercept(from: Point, target: Tank): Point | null {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const a = target.vx ** 2 + target.vy ** 2 - SHELL_SPEED ** 2;
  const b = 2 * (dx * target.vx + dy * target.vy - SHELL_SPEED * MUZZLE);
  const c = dx * dx + dy * dy - MUZZLE * MUZZLE;
  if (c <= 0) return null;
  const time = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return { x: target.x + target.vx * time, y: target.y + target.vy * time };
}

function segmentHitsRect(from: Point, to: Point, rect: DOMRect): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const x1 = (rect.left - SHELL_RADIUS - from.x) / dx;
  const x2 = (rect.right + SHELL_RADIUS - from.x) / dx;
  const y1 = (rect.top - SHELL_RADIUS - from.y) / dy;
  const y2 = (rect.bottom + SHELL_RADIUS - from.y) / dy;
  const enter = Math.max(Math.min(x1, x2), Math.min(y1, y2), 0);
  const exit = Math.min(Math.max(x1, x2), Math.max(y1, y2), 1);
  return enter <= exit;
}

function clearShot(world: World, from: Point, to: Point): boolean {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const muzzle = {
    x: from.x + ((to.x - from.x) * MUZZLE) / length,
    y: from.y + ((to.y - from.y) * MUZZLE) / length,
  };
  return (
    !blocked(world, [], muzzle.x, muzzle.y, SHELL_RADIUS) &&
    !blocked(world, [], to.x, to.y, SHELL_RADIUS) &&
    !world.obstacles.some((rect) => segmentHitsRect(muzzle, to, rect))
  );
}

function findAim(tank: Tank, world: World): number | null {
  const from = turretPivot(tank);
  let aim: number | null = null;
  let closest = SIGHT;
  for (const other of world.tanks) {
    const distance = Math.hypot(other.x - from.x, other.y - from.y);
    if (other === tank || distance >= closest) continue;
    const point = intercept(from, other);
    if (!point || !clearShot(world, from, point)) continue;
    aim = Math.atan2(point.y - from.y, point.x - from.x);
    closest = distance;
  }
  return aim;
}

function aimAndFire(tank: Tank, world: World, dt: number) {
  const aim = findAim(tank, world);
  if (aim !== null) tank.turretTarget = angleDiff(aim, tank.angle);
  const diff = angleDiff(tank.turretTarget, tank.turretAngle);
  const rate = aim === null ? TURRET_RATE : AIM_RATE;
  tank.turretAngle += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
  tank.reload -= dt;
  if (aim === null || tank.reload > 0) return;
  if (Math.abs(angleDiff(tank.angle + tank.turretAngle, aim)) > AIM_TOLERANCE)
    return;
  tank.reload = random(RELOAD_MIN, RELOAD_MAX);
  const from = turretPivot(tank);
  const angle = aim + random(-AIM_NOISE, AIM_NOISE);
  world.shells.push({
    x: from.x + Math.cos(angle) * MUZZLE,
    y: from.y + Math.sin(angle) * MUZZLE,
    vx: Math.cos(angle) * SHELL_SPEED,
    vy: Math.sin(angle) * SHELL_SPEED,
    owner: tank,
  });
  playSound('click', SOUND_GAIN);
}

function isStuck(tank: Tank, dt: number): boolean {
  tank.stuckTimer -= dt;
  if (tank.stuckTimer > 0) return false;
  const moved = Math.hypot(tank.x - tank.anchorX, tank.y - tank.anchorY);
  tank.stuckTimer = STUCK_TIME;
  tank.anchorX = tank.x;
  tank.anchorY = tank.y;
  return moved < STUCK_DISTANCE;
}

function findFreeSpot(tank: Tank, world: World): Point | null {
  const reach = Math.hypot(world.width, world.height);
  for (let distance = ESCAPE_STEP; distance < reach; distance += ESCAPE_STEP) {
    for (let i = 0; i < ESCAPE_DIRECTIONS; i++) {
      const angle = tank.angle + (i / ESCAPE_DIRECTIONS) * Math.PI * 2;
      const x = tank.x + Math.cos(angle) * distance;
      const y = tank.y + Math.sin(angle) * distance;
      if (!blocked(world, world.obstacles, x, y, TANK_RADIUS)) return { x, y };
    }
  }
  return null;
}

function escape(tank: Tank, world: World, dt: number, now: number) {
  if (
    !tank.escape ||
    blocked(world, world.obstacles, tank.escape.x, tank.escape.y, TANK_RADIUS)
  ) {
    tank.escape = findFreeSpot(tank, world);
  }
  if (!tank.escape) {
    destroyTank(world, tank, now);
    return;
  }
  const diff = angleDiff(
    Math.atan2(tank.escape.y - tank.y, tank.escape.x - tank.x),
    tank.angle,
  );
  tank.turn = Math.max(-1, Math.min(1, diff * 3)) * TURN_RATE;
  tank.timer = AVOID_TIME;
  tank.stuckTimer = STUCK_TIME;
  tank.anchorX = tank.x;
  tank.anchorY = tank.y;
  drive(tank, world, [], dt, now, Math.abs(diff) < PIVOT_ANGLE);
}

function updateTank(tank: Tank, world: World, dt: number, now: number) {
  const trapped = world.obstacles.some((rect) =>
    insideRect(rect, tank.x, tank.y, TANK_RADIUS),
  );
  if (trapped) {
    escape(tank, world, dt, now);
    return;
  }
  tank.escape = null;
  if (isStuck(tank, dt)) {
    destroyTank(world, tank, now);
    return;
  }
  tank.timer -= dt;
  if (tank.timer <= 0) chooseAction(tank);
  avoidObstacles(tank, world, world.obstacles);
  drive(tank, world, world.obstacles, dt, now, true);
  aimAndFire(tank, world, dt);
}

function updateShells(world: World, dt: number, now: number) {
  world.shells = world.shells.filter((shell) => {
    shell.x += shell.vx * dt;
    shell.y += shell.vy * dt;
    const hit = world.tanks.find(
      (tank) =>
        tank !== shell.owner &&
        Math.hypot(tank.x - shell.x, tank.y - shell.y) < HIT_RADIUS,
    );
    if (hit) {
      destroyTank(world, hit, now);
      return false;
    }
    if (blocked(world, world.obstacles, shell.x, shell.y, SHELL_RADIUS)) {
      shellExplosion(world, shell, now);
      return false;
    }
    return true;
  });
}

export function updateWorld(world: World, dt: number, now: number) {
  world.tanks.forEach((tank) => updateTank(tank, world, dt, now));
  updateShells(world, dt, now);
  const alive = world.marks.findIndex((mark) => now - mark.time < MARK_LIFE_MS);
  world.marks.splice(0, alive === -1 ? world.marks.length : alive);
  world.explosions = world.explosions.filter(
    (explosion) => now - explosion.time < EXPLOSION_LIFE_MS,
  );
}
