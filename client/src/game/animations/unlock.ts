import type { Animation } from './state';
import {
  jaggedPolygonPath,
  UNLOCK_CRACK_MS,
  UNLOCK_CRUMBLE_MS,
  UNLOCK_DELAY_MS,
} from './state';

type Point = [number, number];

const CRACK_COLOR = '#9a9a9a';
const CRACK_STAGES = 6;
const CRACK_BRANCHES = 7;
const CRACK_SEGMENTS = 4;
const CRACK_BEND = 0.55;
const CRACK_STEP: Point = [0.7, 1.3];
const CRACK_SPREAD: Point = [0, 0.6];
const CRACK_REACH = 1.15;
const CRACK_STAGGER = 0.4;
const CRACK_WIDTH = 0.04;
const SIDE_CRACKS = 6;
const SIDE_CRACK_REACH = 0.5;
const SIDE_CRACK_TURN: Point = [0.6, 1.2];
const SIDE_CRACK_START: Point = [0.3, 0.72];

const ROCK_COUNT = 12;
const PEBBLE_COUNT = 22;
const ROCK_SIZE: Point = [0.1, 0.18];
const PEBBLE_SIZE: Point = [0.04, 0.08];
const ROCK_COLORS = ['#a8a8a8', '#8a8a8a', '#6e6e6e', '#535353'];
const ROCK_DELAY: Point = [0, 0.18];
const ROCK_DRIFT = 0.2;
const ROCK_DROP: Point = [0, 0.4];
const ROCK_GRAVITY = 11;
const ROCK_AIR_SPIN = 2;
const ROCK_PILE: Point = [0, 0.25];
const ROCK_REST = 0.6;
const ROCK_ROLL: Point = [0.06, 0.12];
const ROCK_ROLL_FRICTION = 5;
const ROCK_LIFE: Point = [0.75, 1];
const ROCK_FADE = 0.35;

const DUST_COUNT = 7;
const DUST_COLOR = '#6f6f6f';
const DUST_ALPHA = 0.28;
const DUST_DELAY: Point = [0.15, 0.25];
const DUST_SIZE: Point = [0.15, 0.25];
const DUST_GROWTH = 1;
const DUST_DRIFT = 0.35;
const DUST_RISE = 0.15;
const DUST_LIFE = 0.6;
const DUST_FLOOR_BAND = 0.3;

export interface RockPiece {
  x0: number;
  y0: number;
  size: number;
  color: string;
  delay: number;
  vx: number;
  vy: number;
  floor: number;
  roll: number;
  spin: number;
  rotation0: number;
  life: number;
  jitters: number[];
}

export interface DustPuff {
  x0: number;
  y0: number;
  size: number;
  delay: number;
  vx: number;
  rotation0: number;
  jitters: number[];
}

function between([min, max]: Point): number {
  return min + Math.random() * (max - min);
}

function tileRadius(cx: number, cy: number, points: Point[]): number {
  return Math.max(...points.map(([x, y]) => Math.hypot(x - cx, y - cy)));
}

function crackLine(from: Point, angle: number, length: number): Point[] {
  const line: Point[] = [from];
  let [x, y] = from;
  let heading = angle;
  for (let s = 0; s < CRACK_SEGMENTS; s++) {
    heading += (Math.random() * 2 - 1) * CRACK_BEND;
    const step = (length / CRACK_SEGMENTS) * between(CRACK_STEP);
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    line.push([x, y]);
  }
  return line;
}

function makeCracks(cx: number, cy: number, radius: number) {
  const main = Array.from({ length: CRACK_BRANCHES }, (_, k) => {
    const angle = (k * Math.PI * 2) / CRACK_BRANCHES + between(CRACK_SPREAD);
    return {
      angle,
      points: crackLine([cx, cy], angle, radius * CRACK_REACH),
      start: (k / CRACK_BRANCHES) * CRACK_STAGGER,
    };
  });
  const side = Array.from({ length: SIDE_CRACKS }, () => {
    const parent = main[Math.floor(Math.random() * main.length)];
    const from =
      parent.points[1 + Math.floor(Math.random() * (CRACK_SEGMENTS - 1))];
    const turn = (Math.random() < 0.5 ? -1 : 1) * between(SIDE_CRACK_TURN);
    return {
      points: crackLine(from, parent.angle + turn, radius * SIDE_CRACK_REACH),
      start: between(SIDE_CRACK_START),
    };
  });
  return [...main, ...side];
}

function pointInside(cx: number, cy: number, points: Point[]): Point {
  const k = Math.floor(Math.random() * points.length);
  const [ax, ay] = points[k];
  const [bx, by] = points[(k + 1) % points.length];
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  return [
    cx + u * (ax - cx) + v * (bx - cx),
    cy + u * (ay - cy) + v * (by - cy),
  ];
}

function jitters(sides: number, min: number, range: number): number[] {
  return Array.from({ length: sides }, () => min + Math.random() * range);
}

function makeRocks(
  cx: number,
  cy: number,
  points: Point[],
  radius: number,
): RockPiece[] {
  const bottom = Math.max(...points.map((p) => p[1]));
  const make = (sizeRange: Point): RockPiece => {
    const [x0, y0] = pointInside(cx, cy, points);
    const size = radius * between(sizeRange);
    return {
      x0,
      y0,
      size,
      color: ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)],
      delay: between(ROCK_DELAY),
      vx: (Math.random() * 2 - 1) * ROCK_DRIFT * radius,
      vy: between(ROCK_DROP) * radius,
      floor: Math.max(
        y0,
        bottom - between(ROCK_PILE) * radius - size * ROCK_REST,
      ),
      roll: (Math.random() < 0.5 ? -1 : 1) * between(ROCK_ROLL),
      spin: (Math.random() * 2 - 1) * ROCK_AIR_SPIN,
      rotation0: Math.random() * Math.PI * 2,
      life: (UNLOCK_CRUMBLE_MS / 1000) * between(ROCK_LIFE),
      jitters: jitters(5 + Math.floor(Math.random() * 2), 0.7, 0.4),
    };
  };
  return [
    ...Array.from({ length: ROCK_COUNT }, () => make(ROCK_SIZE)),
    ...Array.from({ length: PEBBLE_COUNT }, () => make(PEBBLE_SIZE)),
  ];
}

function makeDust(points: Point[], radius: number): DustPuff[] {
  const xs = points.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const bottom = Math.max(...points.map((p) => p[1]));
  return Array.from({ length: DUST_COUNT }, () => ({
    x0: minX + (0.2 + Math.random() * 0.6) * (maxX - minX),
    y0: bottom - Math.random() * DUST_FLOOR_BAND * radius,
    size: radius * between(DUST_SIZE),
    delay: between(DUST_DELAY),
    vx: (Math.random() * 2 - 1) * DUST_DRIFT * radius,
    rotation0: Math.random() * Math.PI * 2,
    jitters: jitters(7, 0.75, 0.35),
  }));
}

function rockAt(rock: RockPiece, gravity: number, t: number) {
  const s = t - rock.delay;
  if (s <= 0) return { x: rock.x0, y: rock.y0, rotation: rock.rotation0 };
  const hit =
    (-rock.vy +
      Math.sqrt(rock.vy * rock.vy + 2 * gravity * (rock.floor - rock.y0))) /
    gravity;
  if (s < hit)
    return {
      x: rock.x0 + rock.vx * s,
      y: rock.y0 + rock.vy * s + 0.5 * gravity * s * s,
      rotation: rock.rotation0 + rock.spin * s,
    };
  const rollSpeed = rock.vx + rock.roll * (rock.vy + gravity * hit);
  const rolled =
    (rollSpeed * (1 - Math.exp(-ROCK_ROLL_FRICTION * (s - hit)))) /
    ROCK_ROLL_FRICTION;
  return {
    x: rock.x0 + rock.vx * hit + rolled,
    y: rock.floor,
    rotation: rock.rotation0 + rock.spin * hit + rolled / rock.size,
  };
}

export function makeUnlockEffect(tile: {
  x: number;
  y: number;
  points: Point[];
}): Pick<Animation, 'points' | 'cracks' | 'rocks' | 'dust'> {
  const radius = tileRadius(tile.x, tile.y, tile.points);
  return {
    points: tile.points,
    cracks: makeCracks(tile.x, tile.y, radius),
    rocks: makeRocks(tile.x, tile.y, tile.points, radius),
    dust: makeDust(tile.points, radius),
  };
}

function strokePrefix(
  ctx: CanvasRenderingContext2D,
  line: { x: number; y: number }[],
  fraction: number,
) {
  const amount = fraction * (line.length - 1);
  const whole = Math.floor(amount);
  ctx.moveTo(line[0].x, line[0].y);
  for (let s = 1; s <= whole; s++) ctx.lineTo(line[s].x, line[s].y);
  if (whole < line.length - 1) {
    const part = amount - whole;
    const a = line[whole];
    const b = line[whole + 1];
    ctx.lineTo(a.x + (b.x - a.x) * part, a.y + (b.y - a.y) * part);
  }
}

export function drawUnlock(
  ctx: CanvasRenderingContext2D,
  a: Animation,
  toScreen: (p: { x: number; y: number }) => { x: number; y: number },
  now: number,
) {
  const points = a.points!;
  const toPoint = ([x, y]: Point) => toScreen({ x, y });
  const center = toScreen(a);
  const pixelsPerUnit = toScreen({ x: a.x + 1, y: a.y }).x - center.x;
  const unitRadius = tileRadius(a.x, a.y, points);
  const radius = unitRadius * pixelsPerUnit;
  const elapsed = now - a.startedAt - UNLOCK_DELAY_MS;
  ctx.save();

  if (elapsed < UNLOCK_CRACK_MS) {
    ctx.beginPath();
    points.map(toPoint).forEach((p, k) => {
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.clip();
    const stage =
      Math.ceil((elapsed / UNLOCK_CRACK_MS) * CRACK_STAGES) / CRACK_STAGES;
    ctx.beginPath();
    for (const crack of a.cracks!) {
      if (stage <= crack.start) continue;
      strokePrefix(
        ctx,
        crack.points.map(toPoint),
        Math.min(1, (stage - crack.start) / (1 - crack.start)),
      );
    }
    ctx.strokeStyle = CRACK_COLOR;
    ctx.lineWidth = Math.max(1, radius * CRACK_WIDTH);
    ctx.lineJoin = 'miter';
    ctx.stroke();
    ctx.restore();
    return;
  }

  const t = (elapsed - UNLOCK_CRACK_MS) / 1000;
  const gravity = unitRadius * ROCK_GRAVITY;
  for (const rock of a.rocks!) {
    if (t >= rock.life) continue;
    const at = rockAt(rock, gravity, t);
    const p = toScreen(at);
    ctx.globalAlpha = Math.min(1, (rock.life - t) / (rock.life * ROCK_FADE));
    ctx.fillStyle = rock.color;
    jaggedPolygonPath(
      ctx,
      p.x,
      p.y,
      rock.size * pixelsPerUnit,
      at.rotation,
      rock.jitters,
    );
    ctx.fill();
  }
  ctx.fillStyle = DUST_COLOR;
  for (const puff of a.dust!) {
    const s = t - puff.delay;
    if (s <= 0 || s >= DUST_LIFE) continue;
    const p = toScreen({
      x: puff.x0 + puff.vx * s,
      y: puff.y0 - DUST_RISE * unitRadius * s,
    });
    ctx.globalAlpha = DUST_ALPHA * (1 - s / DUST_LIFE);
    jaggedPolygonPath(
      ctx,
      p.x,
      p.y,
      puff.size * pixelsPerUnit * (1 + (DUST_GROWTH * s) / DUST_LIFE),
      puff.rotation0,
      puff.jitters,
    );
    ctx.fill();
  }
  ctx.restore();
}
