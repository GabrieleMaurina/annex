const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
const DECODE_MAP = new Map(Array.from(ALPHABET).map((c, i) => [c, i]));

export function encodeBase85(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const padded = new Uint8Array(4);
    padded.set(chunk);
    let value =
      padded[0] * 16777216 + padded[1] * 65536 + padded[2] * 256 + padded[3];
    const chars = new Array(5);
    for (let j = 4; j >= 0; j--) {
      chars[j] = ALPHABET[value % 85];
      value = Math.floor(value / 85);
    }
    result += chars.slice(0, chunk.length + 1).join('');
  }
  return result;
}

export function decodeBase85(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i += 5) {
    const chunk = str.slice(i, i + 5);
    const padded = chunk.padEnd(5, ALPHABET[84]);
    let value = 0;
    for (let j = 0; j < 5; j++) {
      value = value * 85 + DECODE_MAP.get(padded[j])!;
    }
    const out = [
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    ];
    for (let j = 0; j < chunk.length - 1; j++) bytes.push(out[j]);
  }
  return new Uint8Array(bytes);
}
