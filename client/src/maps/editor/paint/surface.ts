import { paintContext } from './paintTools';

export function blankSurface(width: number, height: number): ImageData {
  const s = new ImageData(Math.max(1, width), Math.max(1, height));
  s.data.fill(255);
  return s;
}

export function blitSurface(
  surface: ImageData,
  canvas: HTMLCanvasElement,
): void {
  canvas.width = surface.width;
  canvas.height = surface.height;
  paintContext(canvas)?.putImageData(surface, 0, 0);
}

export function surfaceToDataUrl(surface: ImageData): string {
  const c = document.createElement('canvas');
  c.width = surface.width;
  c.height = surface.height;
  c.getContext('2d')?.putImageData(surface, 0, 0);
  return c.toDataURL('image/png');
}

export function decodeToSurface(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return blankSurface(img.naturalWidth, img.naturalHeight);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
