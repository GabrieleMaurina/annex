export interface Territory {
  id: number;
  continentId: number;
  x: number;
  y: number;
  neighbors: number[];
}

interface MapFile {
  territories: Territory[];
  bonuses: number[];
  image: string | null;
  imageMime: string | null;
}

export const DEFAULT_IMAGE_WIDTH = 2560;
export const DEFAULT_IMAGE_HEIGHT = 1440;

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

export interface GeneratedMapData {
  displayName: string;
  territories: Territory[];
  bonuses: number[];
  imageSrc: string;
}

const generatedMaps = new Map<string, GeneratedMapData>();

export function registerGeneratedMap(
  name: string,
  data: GeneratedMapData,
): void {
  generatedMaps.set(name, data);
}

export function getMapDisplayName(mapName: string): string {
  return generatedMaps.get(mapName)?.displayName ?? mapName;
}

export function getGeneratedMapData(
  mapName: string,
): GeneratedMapData | undefined {
  return generatedMaps.get(mapName);
}

export function loadGameMap(mapName: string): Promise<{
  territories: Territory[];
  bonuses: number[];
  imageSrc: string | null;
}> {
  const generated = generatedMaps.get(mapName);
  if (generated) return Promise.resolve(generated);

  return fetch(`/maps/${encodeURIComponent(mapName)}.anx`)
    .then((res) => res.json())
    .then((data: MapFile) => ({
      territories: data.territories,
      bonuses: data.bonuses,
      imageSrc:
        data.image === null
          ? null
          : bytesToDataUrl(decodeBase85(data.image), data.imageMime!),
    }));
}
