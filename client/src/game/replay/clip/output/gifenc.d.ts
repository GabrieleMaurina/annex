declare module 'gifenc' {
  export type Palette = number[][];

  export interface WriteFrameOptions {
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    palette?: Palette;
    repeat?: number;
    dispose?: number;
  }

  export interface GifEncoder {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions,
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array<ArrayBuffer>;
  }

  export function GIFEncoder(): GifEncoder;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
  ): Palette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
  ): Uint8Array;
}
