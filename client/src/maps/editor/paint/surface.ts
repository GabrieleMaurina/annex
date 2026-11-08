import { isBlankImage } from '../defaultImage';
import { decodeGif } from './codec/exactGif';
import { paintContext } from './paintTools';

const PNG_DATA_URL = 'data:image/png;base64,';
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const EXACT_PNG_CHUNKS = ['IHDR', 'IDAT', 'IEND', 'sRGB'];
const COLOR_RGB = 2;
const COLOR_RGBA = 6;
const RGB_CHANNELS = 3;
const RGBA_CHANNELS = 4;
const FILTER_SUB = 1;
const FILTER_UP = 2;
const FILTER_AVERAGE = 3;
const FILTER_PAETH = 4;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc;
});

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

function pipeBytes(
  parts: BlobPart[],
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob(parts).stream().pipeThrough(transform);
  return new Response(stream)
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer));
}

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return ~crc >>> 0;
}

function pngChunk(type: string, body: Uint8Array): Uint8Array<ArrayBuffer> {
  const chunk = new Uint8Array(body.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(body, 8);
  view.setUint32(body.length + 8, crc32(chunk.subarray(4, body.length + 8)));
  return chunk;
}

function paeth(left: number, up: number, corner: number): number {
  const estimate = left + up - corner;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toCorner = Math.abs(estimate - corner);
  if (toLeft <= toUp && toLeft <= toCorner) return left;
  return toUp <= toCorner ? up : corner;
}

function predict(
  filter: number,
  left: number,
  up: number,
  corner: number,
): number {
  if (filter === FILTER_SUB) return left;
  if (filter === FILTER_UP) return up;
  if (filter === FILTER_AVERAGE) return (left + up) >> 1;
  if (filter === FILTER_PAETH) return paeth(left, up, corner);
  return 0;
}

function filterRows({
  data,
  width,
  height,
}: ImageData): Uint8Array<ArrayBuffer> {
  const stride = width * RGBA_CHANNELS;
  const filtered = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    filtered[row] = FILTER_PAETH;
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const left = x >= RGBA_CHANNELS ? data[at - RGBA_CHANNELS] : 0;
      const up = y > 0 ? data[at - stride] : 0;
      const corner =
        x >= RGBA_CHANNELS && y > 0 ? data[at - stride - RGBA_CHANNELS] : 0;
      filtered[row + 1 + x] = data[at] - paeth(left, up, corner);
    }
  }
  return filtered;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function surfaceToDataUrl(surface: ImageData): Promise<string> {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, surface.width);
  view.setUint32(4, surface.height);
  header[8] = 8;
  header[9] = COLOR_RGBA;
  return pipeBytes(
    [filterRows(surface)],
    new CompressionStream('deflate'),
  ).then((compressed) =>
    blobToDataUrl(
      new Blob(
        [
          PNG_SIGNATURE,
          pngChunk('IHDR', header),
          pngChunk('IDAT', compressed),
          pngChunk('IEND', new Uint8Array()),
        ],
        { type: 'image/png' },
      ),
    ),
  );
}

function unfilterRows(
  filtered: Uint8Array,
  width: number,
  height: number,
  channels: number,
): ImageData | null {
  const stride = width * channels;
  if (filtered.length !== (stride + 1) * height) return null;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    const filter = filtered[row];
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const left = x >= channels ? pixels[at - channels] : 0;
      const up = y > 0 ? pixels[at - stride] : 0;
      const corner =
        x >= channels && y > 0 ? pixels[at - stride - channels] : 0;
      pixels[at] = filtered[row + 1 + x] + predict(filter, left, up, corner);
    }
  }
  const surface = new ImageData(width, height);
  surface.data.fill(255);
  for (let p = 0; p < width * height; p++)
    for (let c = 0; c < channels; c++)
      surface.data[p * RGBA_CHANNELS + c] = pixels[p * channels + c];
  return surface;
}

function decodePng(src: string): Promise<ImageData | null> {
  if (!src.startsWith(PNG_DATA_URL)) return Promise.resolve(null);
  const bytes = Uint8Array.from(atob(src.slice(PNG_DATA_URL.length)), (c) =>
    c.charCodeAt(0),
  );
  const view = new DataView(bytes.buffer);
  const compressed: Uint8Array<ArrayBuffer>[] = [];
  let width = 0;
  let height = 0;
  let channels = 0;
  for (let at = PNG_SIGNATURE.length; at + 12 <= bytes.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (!EXACT_PNG_CHUNKS.includes(type)) return Promise.resolve(null);
    if (type === 'IDAT') compressed.push(body);
    if (type === 'IHDR') {
      const exact =
        body[8] === 8 &&
        (body[9] === COLOR_RGB || body[9] === COLOR_RGBA) &&
        body[12] === 0;
      if (!exact) return Promise.resolve(null);
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      channels = body[9] === COLOR_RGBA ? RGBA_CHANNELS : RGB_CHANNELS;
    }
    at += length + 12;
  }
  return pipeBytes(compressed, new DecompressionStream('deflate'))
    .then((filtered) => unfilterRows(filtered, width, height, channels))
    .catch(() => null);
}

function decodeToSurface(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return blankSurface(img.naturalWidth, img.naturalHeight);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function readSurface(src: string): Promise<ImageData> {
  if (isBlankImage(src))
    return loadImage(src).then((img) =>
      blankSurface(img.naturalWidth, img.naturalHeight),
    );
  return decodePng(src).then(
    (surface) =>
      surface ?? decodeGif(src) ?? loadImage(src).then(decodeToSurface),
  );
}
