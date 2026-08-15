export interface Territory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

interface MapFile {
  territories: Territory[];
  image: string | null;
  imageMime: string | null;
}

const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
const DECODE_MAP = new Map(Array.from(ALPHABET).map((c, i) => [c, i]));

function decodeBase85(str: string): Uint8Array {
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

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function loadGameMap(
  mapName: string,
): Promise<{ territories: Territory[]; imageSrc: string | null }> {
  const res = await fetch(`/maps/${encodeURIComponent(mapName)}.anx`);
  const data: MapFile = await res.json();
  const imageSrc =
    data.image === null
      ? null
      : bytesToDataUrl(decodeBase85(data.image), data.imageMime!);
  return { territories: data.territories, imageSrc };
}
