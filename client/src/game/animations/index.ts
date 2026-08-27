import { buildWrappedPathSegments } from '../mapMath';
import { drawFortifyPath } from './arrow';
import { drawEntrench } from './entrench';
import { drawExplosion } from './explosion';
import {
  drawLabel,
  DURATIONS,
  getAnimations,
  TROOP_CHANGE_RING_COLOR,
} from './state';

export function drawAnimations(
  ctx: CanvasRenderingContext2D,
  toScreen: (p: { x: number; y: number }) => { x: number; y: number },
  radius: number,
  mapW: number,
  mapH: number,
) {
  const now = performance.now();
  for (const a of getAnimations()) {
    const p = toScreen({ x: a.x, y: a.y });
    const progress = Math.min(1, (now - a.startedAt) / DURATIONS[a.type]);

    if (a.type === 'explosion') {
      drawExplosion(ctx, a, p, radius, now);
    } else if (a.type === 'entrench') {
      drawEntrench(ctx, a, p, radius, now);
    } else if (a.type === 'add' || a.type === 'remove') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * (1 + progress), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${TROOP_CHANGE_RING_COLOR}, ${1 - progress})`;
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    if (progress < 1 && a.arrowPath) {
      for (let r = 0; r < a.arrowPath.length; r++) {
        const run = a.arrowPath[r];
        if (run.length < 2) continue;
        const runFades = a.arrowFades?.[r];
        for (let i = 0; i < run.length - 1; i++) {
          const segments = buildWrappedPathSegments(
            [run[i], run[i + 1]],
            toScreen,
            mapW,
            mapH,
          );
          drawFortifyPath(ctx, segments, runFades?.[i]);
        }
      }
    }

    drawLabel(ctx, a, p, radius, now);
  }
}

export { drawFortifyPath } from './arrow';
export {
  DICE_ROLL_STEP_DURATION,
  DICE_ROLL_STEPS,
  generateDiceRollSequence,
} from './dice';
export { ENTRENCHED_OCTAGON_SCALE, traceOctagon } from './entrench';
export { drawFogCloud } from './fog';
export { drawPortal } from './portal';
export { drawRadiationCloud } from './radiation';
export {
  areAnimationsDisabled,
  CARD_SET_FLASH_DURATION,
  getAnimationDuration,
  hasActiveAnimations,
  onAnimationsToggle,
  pruneAnimations,
  setAnimationsDisabled,
  setContinuousAnimation,
  setFogActive,
  setPortalsActive,
  setRadiationActive,
  setToxinsActive,
  startAnimation,
  toggleAnimationsDisabled,
} from './state';
export type { AnimationType } from './state';
export { drawToxinCloud } from './toxin';
