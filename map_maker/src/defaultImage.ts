export const DEFAULT_IMAGE_WIDTH = 2560;
export const DEFAULT_IMAGE_HEIGHT = 1440;

let cachedDefaultImage: string | null = null;

export function createDefaultImage(): string {
  if (cachedDefaultImage) return cachedDefaultImage;
  const canvas = document.createElement('canvas');
  canvas.width = DEFAULT_IMAGE_WIDTH;
  canvas.height = DEFAULT_IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
  cachedDefaultImage = canvas.toDataURL('image/png');
  return cachedDefaultImage;
}
