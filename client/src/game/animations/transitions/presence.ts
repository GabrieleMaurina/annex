import type { Point } from '../../GameMap/helpers';

const PRESENCE_MS = 300;
const MAX_STEP_MS = 50;
const OVERSHOOT = 1.70158;

export interface Look<T> {
  state: string;
  data: T;
}

export interface Shown<T> extends Look<T> {
  scale: number;
}

interface Slot {
  shown: Look<unknown>;
  scale: number;
  updatedAt: number;
}

const trackers = new WeakMap<
  HTMLCanvasElement,
  Map<string, Map<string, Slot>>
>();
let activeUntil = 0;

export function presenceActive(): boolean {
  return performance.now() < activeUntil;
}

function grown(scale: number): number {
  const x = scale - 1;
  return 1 + (OVERSHOOT + 1) * x ** 3 + OVERSHOOT * x ** 2;
}

function shrunk(scale: number): number {
  return 1 - (1 - scale) ** 3;
}

function slotsOf(canvas: HTMLCanvasElement, kind: string): Map<string, Slot> {
  let kinds = trackers.get(canvas);
  if (!kinds) {
    kinds = new Map();
    trackers.set(canvas, kinds);
  }
  let slots = kinds.get(kind);
  if (!slots) {
    slots = new Map();
    kinds.set(kind, slots);
  }
  return slots;
}

export function trackPresence<T>(
  canvas: HTMLCanvasElement,
  kind: string,
  looks: Map<string, Look<T>>,
  animate: boolean,
): Map<string, Shown<T>> {
  const slots = slotsOf(canvas, kind);
  const now = performance.now();
  const shown = new Map<string, Shown<T>>();
  for (const key of new Set([...slots.keys(), ...looks.keys()])) {
    const target = looks.get(key) ?? null;
    let slot = slots.get(key);
    if (!slot) {
      slot = { shown: target!, scale: animate ? 0 : 1, updatedAt: now };
      slots.set(key, slot);
    }
    const step = Math.min(now - slot.updatedAt, MAX_STEP_MS) / PRESENCE_MS;
    slot.updatedAt = now;
    const settled = target !== null && target.state === slot.shown.state;
    if (settled || (target && !animate)) {
      slot.shown = target;
      slot.scale = animate ? Math.min(1, slot.scale + step) : 1;
    } else if (!animate) {
      slots.delete(key);
      continue;
    } else {
      slot.scale = Math.max(0, slot.scale - step);
      if (slot.scale === 0 && !target) {
        slots.delete(key);
        continue;
      }
      if (slot.scale === 0) slot.shown = target!;
    }
    if (slot.scale < 1 || !settled) activeUntil = now + MAX_STEP_MS * 2;
    shown.set(key, {
      ...(slot.shown as Look<T>),
      scale: settled || !animate ? grown(slot.scale) : shrunk(slot.scale),
    });
  }
  return shown;
}

export function drawScaled(
  ctx: CanvasRenderingContext2D,
  center: Point,
  scale: number,
  draw: () => void,
) {
  if (scale <= 0) return;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.scale(scale, scale);
  ctx.translate(-center.x, -center.y);
  draw();
  ctx.restore();
}
