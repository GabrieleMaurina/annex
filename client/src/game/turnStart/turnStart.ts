import { drawEndCard } from '../endCard/endCard';

export const TURN_START_MS = 1200;

const PEAK_MS = 240;
const PEAK_ALPHA = 0.9;
const BLUR_SHARE = 0.09;

export interface TurnFlash {
  playerId: number;
}

export interface TurnStartOverlay {
  startedAt: number;
  playerId: number;
  bannerShown: boolean;
}

export function drawTurnHalo(
  ctx: CanvasRenderingContext2D,
  canvasSize: { w: number; h: number },
  map: { x: number; y: number; w: number; h: number },
  color: string,
  elapsed: number,
) {
  const alpha =
    elapsed < PEAK_MS
      ? elapsed / PEAK_MS
      : 1 - (elapsed - PEAK_MS) / (TURN_START_MS - PEAK_MS);
  if (alpha <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvasSize.w, canvasSize.h);
  ctx.rect(map.x, map.y, map.w, map.h);
  ctx.clip('evenodd');
  ctx.shadowColor = color;
  ctx.shadowBlur =
    Math.min(canvasSize.w, canvasSize.h) * BLUR_SHARE * ctx.getTransform().a;
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.min(1, alpha * PEAK_ALPHA);
  ctx.fillRect(map.x, map.y, map.w, map.h);
  ctx.restore();
}

export function drawTurnBanner(
  ctx: CanvasRenderingContext2D,
  canvasSize: { w: number; h: number },
  color: string,
  elapsed: number,
) {
  drawEndCard(
    ctx,
    canvasSize.w,
    canvasSize.h,
    { text: 'YOUR TURN', color },
    elapsed,
    null,
    true,
  );
}
