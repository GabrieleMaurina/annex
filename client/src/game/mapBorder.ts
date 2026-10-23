type Span = [number, number];

export interface MapBorder {
  width: number;
  height: number;
  top: Span[];
  bottom: Span[];
  left: Span[];
  right: Span[];
}

const DARK_LUMA = 40;
const MIN_SPAN = 100;

function isDark(data: Uint8ClampedArray, i: number): boolean {
  const yiq = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  return (yiq * data[i + 3]) / 255 < DARK_LUMA;
}

function cleanSpans(spans: Span[], count: number): Span[] {
  const merged: Span[] = [];
  for (const [s, e] of spans) {
    if (e - s < MIN_SPAN) continue;
    const last = merged[merged.length - 1];
    if (last && s - last[1] < MIN_SPAN) last[1] = e;
    else merged.push([s, e]);
  }
  if (merged.length === 0) return merged;
  if (merged[0][0] < MIN_SPAN) merged[0][0] = 0;
  const last = merged[merged.length - 1];
  if (count - last[1] < MIN_SPAN) last[1] = count;
  return merged;
}

function darkSpans(
  pixels: ImageData,
  first: number,
  step: number,
  count: number,
): Span[] {
  const spans: Span[] = [];
  for (let k = 0; k < count; k++) {
    if (!isDark(pixels.data, (first + k * step) * 4)) continue;
    const last = spans[spans.length - 1];
    if (last && last[1] === k) last[1] = k + 1;
    else spans.push([k, k + 1]);
  }
  return cleanSpans(spans, count);
}

export function mapBorder(pixels: ImageData): MapBorder {
  const { width, height } = pixels;
  return {
    width,
    height,
    top: darkSpans(pixels, 0, 1, width),
    bottom: darkSpans(pixels, (height - 1) * width, 1, width),
    left: darkSpans(pixels, 0, width, height),
    right: darkSpans(pixels, width - 1, width, height),
  };
}

const imageBorders = new WeakMap<HTMLImageElement, MapBorder>();

export function imageBorder(image: HTMLImageElement): MapBorder {
  let border = imageBorders.get(image);
  if (!border) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    border = mapBorder(ctx.getImageData(0, 0, canvas.width, canvas.height));
    imageBorders.set(image, border);
  }
  return border;
}

export function drawMapBorder(
  ctx: CanvasRenderingContext2D,
  border: MapBorder | null,
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(
    x - thickness,
    y - thickness,
    w + thickness * 2,
    h + thickness * 2,
  );
  if (!border) return;
  ctx.fillStyle = '#808080';
  const sx = w / border.width;
  const sy = h / border.height;
  const fromX = (s: number) => (s === 0 ? x - thickness : x + s * sx);
  const toX = (e: number) =>
    e === border.width ? x + w + thickness : x + e * sx;
  for (const [s, e] of border.top)
    ctx.fillRect(fromX(s), y - thickness, toX(e) - fromX(s), thickness);
  for (const [s, e] of border.bottom)
    ctx.fillRect(fromX(s), y + h, toX(e) - fromX(s), thickness);
  for (const [s, e] of border.left)
    ctx.fillRect(x - thickness, y + s * sy, thickness, (e - s) * sy);
  for (const [s, e] of border.right)
    ctx.fillRect(x + w, y + s * sy, thickness, (e - s) * sy);
}
