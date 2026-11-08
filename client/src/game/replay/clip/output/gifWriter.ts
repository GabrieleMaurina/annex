import { applyPalette, GIFEncoder, quantize, type Palette } from 'gifenc';

const PALETTE_COLORS = 255;
const TRANSPARENT_INDEX = 255;

export function buildPalette(samples: ImageData[]): Palette {
  const pixels = new Uint8Array(
    samples.reduce((sum, sample) => sum + sample.data.length, 0),
  );
  let offset = 0;
  for (const sample of samples) {
    pixels.set(sample.data, offset);
    offset += sample.data.length;
  }
  return quantize(pixels, PALETTE_COLORS);
}

export function createGifWriter(
  palette: Palette,
  width: number,
  height: number,
) {
  const encoder = GIFEncoder();
  const fileColors: Palette = [...palette];
  while (fileColors.length <= TRANSPARENT_INDEX) fileColors.push([0, 0, 0]);
  let previous: Uint8Array | null = null;

  return {
    add(rgba: Uint8ClampedArray, delayMs: number) {
      const indexed = applyPalette(rgba, palette);
      const frame = previous ? new Uint8Array(indexed.length) : indexed;
      if (previous)
        for (let i = 0; i < indexed.length; i++)
          frame[i] =
            indexed[i] === previous[i] ? TRANSPARENT_INDEX : indexed[i];
      encoder.writeFrame(frame, width, height, {
        palette: previous ? undefined : fileColors,
        delay: delayMs,
        transparent: previous !== null,
        transparentIndex: TRANSPARENT_INDEX,
        dispose: 1,
      });
      previous = indexed;
    },
    finish(): Blob {
      encoder.finish();
      return new Blob([encoder.bytes()], { type: 'image/gif' });
    },
  };
}
