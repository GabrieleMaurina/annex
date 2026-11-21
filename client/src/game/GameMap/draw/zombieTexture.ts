import { ZOMBIE_TEXTURE_URL } from '../../../lib/palette';
import type { ClickableRegions } from '../../regions/clickableRegions';

const REFERENCE_WIDTH = 2960;
const TILE_SIZE = 40;
const TILE_SCREEN_SIZE = 14;

const image = new Image();
let ready = false;
const loaded = new Promise<void>((resolve) => {
  image.onload = () => {
    ready = true;
    resolve();
  };
});
image.src = ZOMBIE_TEXTURE_URL;
let markerPattern: { tileSize: number; pattern: CanvasPattern } | null = null;

const layers = new WeakMap<
  ClickableRegions,
  { key: string; canvas: HTMLCanvasElement }
>();

export function zombieTextureReady(): boolean {
  return ready;
}

export function onZombieTextureReady(callback: () => void): void {
  loaded.then(callback);
}

export function zombiePattern(
  ctx: CanvasRenderingContext2D,
  tileSize: number,
): CanvasPattern | null {
  if (!ready) return null;
  const pattern = ctx.createPattern(image, 'repeat');
  pattern?.setTransform(new DOMMatrix().scale(tileSize / TILE_SIZE));
  return pattern;
}

export function fillZombieTexture(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  uiScale: number,
): void {
  const tileSize = TILE_SCREEN_SIZE * uiScale;
  if (markerPattern?.tileSize !== tileSize) {
    const pattern = zombiePattern(ctx, tileSize);
    if (!pattern) return;
    markerPattern = { tileSize, pattern };
  }
  ctx.fillStyle = markerPattern.pattern;
  ctx.fill(path);
}

export function zombieTextureLayer(
  regions: ClickableRegions,
  ids: Set<number>,
  key: string,
): HTMLCanvasElement | null {
  if (!ready || ids.size === 0) return null;
  const cached = layers.get(regions);
  if (cached?.key === key) return cached.canvas;
  const canvas = cached?.canvas ?? document.createElement('canvas');
  canvas.width = regions.width;
  canvas.height = regions.height;
  const ctx = canvas.getContext('2d')!;
  const pattern = zombiePattern(
    ctx,
    (TILE_SCREEN_SIZE * regions.width) / REFERENCE_WIDTH,
  );
  if (!pattern) return null;
  ctx.fillStyle = pattern;
  for (const id of ids) ctx.fill(regions.shapes.get(id)!.fill);
  layers.set(regions, { key, canvas });
  return canvas;
}
