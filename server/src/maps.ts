import { createHash } from 'crypto';
import { Engine } from 'engine';
import { Binary } from 'mongodb';
import { storeMap } from './db';

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
  if (!map || !map.imageSrc) return Promise.resolve(null);
  const image = decodeDataUrl(map.imageSrc);
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
