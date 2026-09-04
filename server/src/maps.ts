import { createHash } from 'crypto';
import { BUILTIN_MAP_NAMES, Engine } from 'engine';
import fs from 'fs';
import { Binary } from 'mongodb';
import path from 'path';
import { Socket } from 'socket.io';
import { storeMap } from './db';

const mapsDir = path.resolve(__dirname, '..', '..', 'client', 'public', 'maps');

const BASE85_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
const BASE85_DECODE = new Map(
  Array.from(BASE85_ALPHABET).map((c, i) => [c, i]),
);

function decodeBase85(str: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i += 5) {
    const chunk = str.slice(i, i + 5);
    const padded = chunk.padEnd(5, BASE85_ALPHABET[84]);
    let value = 0;
    for (let j = 0; j < 5; j++)
      value = value * 85 + BASE85_DECODE.get(padded[j])!;
    const out = [
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    ];
    for (let j = 0; j < chunk.length - 1; j++) bytes.push(out[j]);
  }
  return Buffer.from(bytes);
}

const builtinImages = new Map<string, { bytes: Buffer; mime: string }>();

export function loadMaps(engine: Engine): void {
  const entries = BUILTIN_MAP_NAMES.map((name) => {
    const data = JSON.parse(
      fs.readFileSync(path.join(mapsDir, `${name}.anx`), 'utf-8'),
    );
    if (typeof data.image === 'string' && typeof data.imageMime === 'string')
      builtinImages.set(data.name, {
        bytes: decodeBase85(data.image),
        mime: data.imageMime,
      });
    return {
      name: data.name,
      territories: data.territories,
      bonuses: data.bonuses,
    };
  });
  engine.loadMaps(entries);
}

export function registerMapsHandlers(socket: Socket, engine: Engine) {
  socket.on('maps:list', (callback: (names: string[]) => void) => {
    if (typeof callback !== 'function') return;
    callback(engine.listMaps());
  });
}

function decodeDataUrl(src: string): { bytes: Buffer; mime: string } | null {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(src);
  if (!match) return null;
  return { bytes: Buffer.from(match[2], 'base64'), mime: match[1] };
}

export function persistGameMap(
  engine: Engine,
  gameName: string,
): Promise<string | null> {
  const map = engine.mapForGame(gameName);
  if (!map) return Promise.resolve(null);
  const image = map.imageSrc
    ? decodeDataUrl(map.imageSrc)
    : builtinImages.get(map.name);
  if (!image) return Promise.resolve(null);

  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        territories: map.territories,
        bonuses: map.bonuses,
        imageMime: image.mime,
      }),
    )
    .update(image.bytes)
    .digest('hex');

  return storeMap({
    _id: hash,
    name: map.name,
    territories: map.territories,
    bonuses: map.bonuses,
    generation: map.generation,
    image: new Binary(image.bytes),
    imageMime: image.mime,
  })
    .then(() => hash)
    .catch(() => null);
}
