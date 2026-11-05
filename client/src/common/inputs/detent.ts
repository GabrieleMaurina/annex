import { playSound } from '../../lib/sounds';

const WALL_PUSHES = 1;
const PUSH_THROUGH_MS = 500;

let wall: { direction: number; at: number; pushes: number } | null = null;
let lastPush = { at: Number.NaN, value: 0, delta: 0, result: 0 };

function resolvePush(
  value: number,
  delta: number,
  min: number,
  max: number,
  at: number,
): number {
  const direction = Math.sign(delta);
  const edge = direction > 0 ? max : min;
  if (value !== edge) {
    wall = null;
    playSound('click');
    return Math.min(max, Math.max(min, value + delta));
  }
  const pushes =
    wall?.direction === direction && at - wall.at < PUSH_THROUGH_MS
      ? wall.pushes
      : 0;
  if (min !== max && pushes >= WALL_PUSHES) {
    wall = null;
    playSound('click');
    return direction > 0 ? min : max;
  }
  wall = { direction, at, pushes: pushes + 1 };
  playSound('bass');
  return value;
}

export function detentStep(
  value: number,
  delta: number,
  min: number,
  max: number,
  at = performance.now(),
): number {
  if (
    at === lastPush.at &&
    value === lastPush.value &&
    delta === lastPush.delta
  )
    return lastPush.result;
  const result = resolvePush(value, delta, min, max, at);
  lastPush = { at, value, delta, result };
  return result;
}
