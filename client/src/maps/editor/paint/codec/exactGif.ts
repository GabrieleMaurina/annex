const GIF_DATA_URL = 'data:image/gif;base64,';
const SIGNATURES = ['GIF89a', 'GIF87a'];
const HEADER_BYTES = 13;
const GLOBAL_TABLE = 0x80;
const IMAGE_SEPARATOR = 0x2c;
const DESCRIPTOR_BYTES = 11;
const MAX_CODES = 4096;
const MAX_CODE_SIZE = 12;
const RGBA_CHANNELS = 4;
const OPAQUE = 255;

function word(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

function lzwDecode(
  data: Uint8Array,
  minCodeSize: number,
  size: number,
): Uint8Array | null {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const prefix = new Uint16Array(MAX_CODES);
  const suffix = new Uint8Array(MAX_CODES);
  const first = new Uint8Array(MAX_CODES);
  const length = new Uint16Array(MAX_CODES);
  for (let i = 0; i < clear; i++) {
    suffix[i] = i;
    first[i] = i;
    length[i] = 1;
  }
  const out = new Uint8Array(size);
  let written = 0;
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let previous = -1;
  let buffer = 0;
  let bits = 0;
  let at = 0;
  while (written < size) {
    while (bits < codeSize) {
      if (at >= data.length) return null;
      buffer |= data[at++] << bits;
      bits += 8;
    }
    const code = buffer & ((1 << codeSize) - 1);
    buffer >>= codeSize;
    bits -= codeSize;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = end + 1;
      previous = -1;
      continue;
    }
    if (code === end) break;
    if (previous < 0) {
      if (code >= clear) return null;
      out[written++] = code;
      previous = code;
      continue;
    }
    if (code > next) return null;
    if (next < MAX_CODES) {
      prefix[next] = previous;
      suffix[next] = first[code < next ? code : previous];
      first[next] = first[previous];
      length[next] = length[previous] + 1;
      next++;
    }
    if (written + length[code] > size) return null;
    let position = written + length[code] - 1;
    for (let c = code; ; c = prefix[c]) {
      out[position--] = suffix[c];
      if (length[c] === 1) break;
    }
    written += length[code];
    if (next === 1 << codeSize && codeSize < MAX_CODE_SIZE) codeSize++;
    previous = code;
  }
  return written === size ? out : null;
}

function joinBlocks(bytes: Uint8Array, start: number): Uint8Array | null {
  const blocks: Uint8Array[] = [];
  let at = start;
  while (at < bytes.length && bytes[at] !== 0) {
    const end = at + 1 + bytes[at];
    if (end > bytes.length) return null;
    blocks.push(bytes.subarray(at + 1, end));
    at = end;
  }
  const joined = new Uint8Array(blocks.reduce((sum, b) => sum + b.length, 0));
  let offset = 0;
  for (const block of blocks) {
    joined.set(block, offset);
    offset += block.length;
  }
  return joined;
}

export function decodeGif(src: string): ImageData | null {
  if (!src.startsWith(GIF_DATA_URL)) return null;
  const bytes = Uint8Array.from(atob(src.slice(GIF_DATA_URL.length)), (c) =>
    c.charCodeAt(0),
  );
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (bytes.length < HEADER_BYTES || !SIGNATURES.includes(signature))
    return null;
  const width = word(bytes, 6);
  const height = word(bytes, 8);
  const packed = bytes[10];
  if (!(packed & GLOBAL_TABLE) || width === 0 || height === 0) return null;
  const colors = 1 << ((packed & 7) + 1);
  const at = HEADER_BYTES + colors * 3;
  if (bytes[at] !== IMAGE_SEPARATOR) return null;
  const plain =
    word(bytes, at + 1) === 0 &&
    word(bytes, at + 3) === 0 &&
    word(bytes, at + 5) === width &&
    word(bytes, at + 7) === height &&
    bytes[at + 9] === 0;
  if (!plain) return null;
  const data = joinBlocks(bytes, at + DESCRIPTOR_BYTES);
  const indices = data && lzwDecode(data, bytes[at + 10], width * height);
  if (!indices) return null;
  const surface = new ImageData(width, height);
  for (let p = 0; p < indices.length; p++) {
    if (indices[p] >= colors) return null;
    const color = HEADER_BYTES + indices[p] * 3;
    const o = p * RGBA_CHANNELS;
    surface.data[o] = bytes[color];
    surface.data[o + 1] = bytes[color + 1];
    surface.data[o + 2] = bytes[color + 2];
    surface.data[o + 3] = OPAQUE;
  }
  return surface;
}
