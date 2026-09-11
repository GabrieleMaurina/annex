import { mapImageSize } from 'engine';

const DEFAULT_SIZE = mapImageSize('medium');
export const DEFAULT_IMAGE_WIDTH = DEFAULT_SIZE.width;
export const DEFAULT_IMAGE_HEIGHT = DEFAULT_SIZE.height;

const blankCache = new Map<string, string>();

export function createBlankImage(width: number, height: number): string {
  const key = `${width}x${height}`;
  const cached = blankCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.createImageData(width, height);
  image.data.fill(255);
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL('image/png');
  blankCache.set(key, url);
  return url;
}

export function isBlankImage(src: string): boolean {
  for (const url of blankCache.values()) if (url === src) return true;
  return false;
}

export function createDefaultImage(): string {
  return createBlankImage(DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
}
