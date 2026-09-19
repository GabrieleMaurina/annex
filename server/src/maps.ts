import { Engine } from 'engine';
import { Binary } from 'mongodb';
import { replayMapId, storeMap } from './db';

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

  const hash = replayMapId({ ...map, imageMime: image.mime }, image.bytes);

  return storeMap({
    _id: hash,
    name: map.name,
    territories: map.territories,
    seaTerritories: map.seaTerritories,
    bonuses: map.bonuses,
    wraps: map.wraps,
    generation: map.generation,
    image: new Binary(image.bytes),
    imageMime: image.mime,
  })
    .then(() => hash)
    .catch(() => null);
}
