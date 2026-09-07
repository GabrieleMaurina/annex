export function hexToRgb(hex: string): number {
  return (
    (parseInt(hex.slice(1, 3), 16) << 16) |
    (parseInt(hex.slice(3, 5), 16) << 8) |
    parseInt(hex.slice(5, 7), 16)
  );
}

export class PaletteBuilder {
  readonly colors: number[] = [];
  private readonly indexOf = new Map<number, number>();

  index(rgb: number): number {
    let i = this.indexOf.get(rgb);
    if (i === undefined) {
      i = this.colors.length;
      this.colors.push(rgb);
      this.indexOf.set(rgb, i);
    }
    return i;
  }

  indexHex(hex: string): number {
    return this.index(hexToRgb(hex));
  }
}

export function paletteGif(
  width: number,
  height: number,
  indices: Uint8Array,
  palette: number[],
): string {
  return `data:image/gif;base64,${base64(encodeGif(width, height, indices, palette))}`;
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
