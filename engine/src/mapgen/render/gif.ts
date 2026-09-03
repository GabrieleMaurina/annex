import { SpecialEdge } from '../pipeline/connectivity';
import { GridPoint } from '../pipeline/placement';
import {
  continentEarthTone,
  TERRITORY_STROKE_COLOR,
  WATER_COLOR,
} from './palette';

const BORDER_RADIUS = 2;
const DASH_ON = 8;
const DASH_PERIOD = 22;

export function renderMapImage(
  labelGrid: Int16Array,
  width: number,
  height: number,
  continentIdByTerritory: number[],
  centroids: GridPoint[],
  specialEdges: SpecialEdge[],
): string {
  const { indices, palette } = rasterize(
    labelGrid,
    width,
    height,
    continentIdByTerritory,
    centroids,
    specialEdges,
  );
  return `data:image/gif;base64,${base64(encodeGif(width, height, indices, palette))}`;
}

function hexToRgb(hex: string): number {
  return (
    (parseInt(hex.slice(1, 3), 16) << 16) |
    (parseInt(hex.slice(3, 5), 16) << 8) |
    parseInt(hex.slice(5, 7), 16)
  );
}

function rasterize(
  labelGrid: Int16Array,
  width: number,
  height: number,
  continentIdByTerritory: number[],
  centroids: GridPoint[],
  specialEdges: SpecialEdge[],
): { indices: Uint8Array; palette: number[] } {
  const palette: number[] = [];
  const paletteOf = new Map<number, number>();
  const index = (rgb: number): number => {
    let i = paletteOf.get(rgb);
    if (i === undefined) {
      i = palette.length;
      palette.push(rgb);
      paletteOf.set(rgb, i);
    }
    return i;
  };

  const water = index(hexToRgb(WATER_COLOR));
  const stroke = index(hexToRgb(TERRITORY_STROKE_COLOR));
  const territoryColor = continentIdByTerritory.map((c) =>
    index(hexToRgb(continentEarthTone(c))),
  );

  const size = width * height;
  const r = BORDER_RADIUS;

  const thin = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const label = labelGrid[i];
    const x = i % width;
    if (
      (x + 1 < width && labelGrid[i + 1] !== label) ||
      (i + width < size && labelGrid[i + width] !== label)
    )
      thin[i] = 1;
  }

  const seam = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!thin[y * width + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) seam[ny * width + nx] = 1;
        }
      }
    }
  }

  const indices = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const label = labelGrid[i];
    indices[i] = seam[i] ? stroke : label < 0 ? water : territoryColor[label];
  }

  for (const { a, b } of specialEdges) {
    const from = centroids[a];
    const to = centroids[b];
    if (!from || !to) continue;
    const dx = to.gx - from.gx;
    const dy = to.gy - from.gy;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let s = 0; s <= steps; s++) {
      if (s % DASH_PERIOD >= DASH_ON) continue;
      const px = Math.round(from.gx + (dx * s) / steps);
      const py = Math.round(from.gy + (dy * s) / steps);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      if (labelGrid[py * width + px] >= 0) continue;
      for (let ey = -r; ey <= r; ey++) {
        const ny = py + ey;
        if (ny < 0 || ny >= height) continue;
        for (let ex = -r; ex <= r; ex++) {
          const nx = px + ex;
          if (nx >= 0 && nx < width) indices[ny * width + nx] = stroke;
        }
      }
    }
  }

  return { indices, palette };
}

const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const IMAGE_SEPARATOR = 0x2c;
const GIF_TRAILER = 0x3b;

function encodeGif(
  width: number,
  height: number,
  indices: Uint8Array,
  palette: number[],
): Uint8Array {
  let bits = 1;
  while (1 << bits < palette.length) bits++;
  if (bits < 2) bits = 2;
  const tableSize = 1 << bits;

  const out: number[] = [];
  const word = (w: number) => out.push(w & 0xff, (w >> 8) & 0xff);

  out.push(...GIF89A);
  word(width);
  word(height);
  out.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0);

  for (let i = 0; i < tableSize; i++) {
    const rgb = i < palette.length ? palette[i] : 0;
    out.push((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff);
  }

  out.push(IMAGE_SEPARATOR);
  word(0);
  word(0);
  word(width);
  word(height);
  out.push(0);

  const minCodeSize = Math.max(2, bits);
  out.push(minCodeSize);
  for (const b of lzw(indices, minCodeSize)) out.push(b);

  out.push(GIF_TRAILER);
  return Uint8Array.from(out);
}

function lzw(pixels: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<number, number>();

  const bytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  emit(clearCode);
  let current = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const next = pixels[i];
    const key = (current << 8) | next;
    const existing = dict.get(key);
    if (existing !== undefined) {
      current = existing;
      continue;
    }
    emit(current);
    if (nextCode === 4096) {
      emit(clearCode);
      dict = new Map();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      dict.set(key, nextCode++);
    }
    current = next;
  }
  emit(current);
  emit(eoiCode);
  if (bitCount > 0) bytes.push(bitBuffer & 0xff);

  const blocked: number[] = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    blocked.push(chunk.length, ...chunk);
  }
  blocked.push(0);
  return blocked;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64[(n >> 18) & 63] +
      B64[(n >> 12) & 63] +
      B64[(n >> 6) & 63] +
      B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}
