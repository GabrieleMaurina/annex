export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 10;

const BORDER_REFERENCE_RADIUS = 12;

export function borderScale(fitVertexRadius: number): number {
  return Math.min(1, fitVertexRadius / BORDER_REFERENCE_RADIUS);
}

const RUBBER_RESISTANCE = 0.55;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rubberBand(overshoot: number, dimension: number): number {
  return (
    (overshoot * dimension * RUBBER_RESISTANCE) /
    (dimension + RUBBER_RESISTANCE * overshoot)
  );
}

function rubberBandInverse(displayed: number, dimension: number): number {
  return (
    (displayed * dimension) / (RUBBER_RESISTANCE * (dimension - displayed))
  );
}

function rubberClamp(value: number, limit: number, dimension: number): number {
  if (Math.abs(value) <= limit) return value;
  const sign = value < 0 ? -1 : 1;
  return sign * (limit + rubberBand(Math.abs(value) - limit, dimension));
}

function rubberClampInverse(
  displayed: number,
  limit: number,
  dimension: number,
): number {
  if (Math.abs(displayed) <= limit) return displayed;
  const sign = displayed < 0 ? -1 : 1;
  return (
    sign * (limit + rubberBandInverse(Math.abs(displayed) - limit, dimension))
  );
}

const DRAG_BACKGROUND_FRACTION = 0.3;

function panLimits(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
) {
  const slack = 0.5 - DRAG_BACKGROUND_FRACTION;
  return {
    x: Math.max(0, (imgW * scaleX) / 2 - canvasW * slack),
    y: Math.max(0, (imgH * scaleY) / 2 - canvasH * slack),
  };
}

export function clampPan(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
  panX: number,
  panY: number,
) {
  const { x: kx, y: ky } = panLimits(
    canvasW,
    canvasH,
    scaleX,
    scaleY,
    imgW,
    imgH,
  );
  return { x: clamp(panX, -kx, kx), y: clamp(panY, -ky, ky) };
}

export function zoomTransform(
  prev: { zoom: number; offsetX: number; offsetY: number },
  canvasW: number,
  canvasH: number,
  imgW: number,
  imgH: number,
  pos: { x: number; y: number },
  factor: number,
) {
  const baseScale = Math.min(canvasW / imgW, canvasH / imgH);
  const oldScale = baseScale * prev.zoom;
  const oldOffX = (canvasW - imgW * oldScale) / 2 + prev.offsetX;
  const oldOffY = (canvasH - imgH * oldScale) / 2 + prev.offsetY;
  const worldX = (pos.x - oldOffX) / oldScale;
  const worldY = (pos.y - oldOffY) / oldScale;
  const newZoom = clamp(prev.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const newScale = baseScale * newZoom;
  const { x, y } = clampPan(
    canvasW,
    canvasH,
    newScale,
    newScale,
    imgW,
    imgH,
    pos.x - worldX * newScale - (canvasW - imgW * newScale) / 2,
    pos.y - worldY * newScale - (canvasH - imgH * newScale) / 2,
  );
  return { zoom: newZoom, offsetX: x, offsetY: y };
}

export function screenOffset(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
  panX: number,
  panY: number,
) {
  const { x: kx, y: ky } = panLimits(
    canvasW,
    canvasH,
    scaleX,
    scaleY,
    imgW,
    imgH,
  );
  return {
    x: (canvasW - imgW * scaleX) / 2 + rubberClamp(panX, kx, canvasW),
    y: (canvasH - imgH * scaleY) / 2 + rubberClamp(panY, ky, canvasH),
  };
}

export function createSettleSampler(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
  panX: number,
  panY: number,
) {
  const { x: kx, y: ky } = panLimits(
    canvasW,
    canvasH,
    scaleX,
    scaleY,
    imgW,
    imgH,
  );
  const target = { x: clamp(panX, -kx, kx), y: clamp(panY, -ky, ky) };
  const from = {
    x: rubberClamp(panX, kx, canvasW),
    y: rubberClamp(panY, ky, canvasH),
  };
  const settled =
    Math.abs(from.x - target.x) < 0.5 && Math.abs(from.y - target.y) < 0.5;
  return {
    target,
    settled,
    sample(eased: number) {
      const dx = from.x + (target.x - from.x) * eased;
      const dy = from.y + (target.y - from.y) * eased;
      return {
        x: rubberClampInverse(dx, kx, canvasW),
        y: rubberClampInverse(dy, ky, canvasH),
      };
    },
  };
}

export function easeOutCubic(progress: number): number {
  const remaining = 1 - progress;
  return 1 - remaining * remaining * remaining;
}
