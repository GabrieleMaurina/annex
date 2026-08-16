export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getScales(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgW: number,
  imgH: number,
) {
  return {
    imgW,
    imgH,
    scaleX: (canvasW / imgW) * zoom,
    scaleY: (canvasH / imgH) * zoom,
  };
}

export function clampOffset(
  canvasW: number,
  canvasH: number,
  scaleX: number,
  scaleY: number,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
) {
  return {
    x: clamp(x, canvasW - imgW * scaleX, 0),
    y: clamp(y, canvasH - imgH * scaleY, 0),
  };
}

export function getClampedOffset(
  canvasW: number,
  canvasH: number,
  zoom: number,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
) {
  const { scaleX, scaleY } = getScales(canvasW, canvasH, zoom, imgW, imgH);
  return clampOffset(canvasW, canvasH, scaleX, scaleY, imgW, imgH, x, y);
}
