import { playSound } from '../../lib/sounds';

const WHEEL_GESTURE_GAP_MS = 300;

let lastWheelAt = -Infinity;
let lastPushAt = Number.NaN;
let restingOnEdge = false;

export function isNewWheelGesture(): boolean {
  const now = performance.now();
  const isNew = now - lastWheelAt > WHEEL_GESTURE_GAP_MS;
  lastWheelAt = now;
  return isNew;
}

export function wrapStep(
  value: number,
  delta: number,
  min: number,
  max: number,
  newGesture: boolean,
  at = performance.now(),
): number {
  const atEdge = value === (delta > 0 ? max : min);
  const wraps = atEdge && newGesture && min !== max;
  const blocked = atEdge && !wraps;
  if (at !== lastPushAt) {
    lastPushAt = at;
    if (!blocked) playSound('click');
    else if (!restingOnEdge) playSound('bass');
    restingOnEdge = blocked;
  }
  if (wraps) return delta > 0 ? min : max;
  return Math.min(max, Math.max(min, value + delta));
}
