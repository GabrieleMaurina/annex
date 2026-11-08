import type {
  DirectionalConnection,
  LockedTile,
  TimedConnection,
} from '../../../lib/types';
import { loadEndCardLogo } from '../../endCard/endCard';
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  loadGameMap,
  placeNamesFor,
  type PlaceNames,
  type SeaTerritory,
  type Territory,
} from '../../mapData';
import { buildForcedWraps, type ForcedWraps } from '../../mapMath';
import {
  loadClickableRegions,
  type ClickableRegions,
} from '../../regions/clickableRegions';
import type { MapSwitching } from '../../switches/switches';

export interface ClipScene {
  territories: Territory[];
  seaTerritories: SeaTerritory[];
  bonuses: number[];
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
  switching: MapSwitching;
  lockedTiles: LockedTile[];
  forcedWraps: ForcedWraps;
  regions: ClickableRegions | null;
  placeNames: PlaceNames;
  image: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  imgDims: { w: number; h: number };
}

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The map image failed to load.'));
    image.src = src;
  });
}

export function loadClipScene(
  mapName: string,
  playerMapId: string | null,
): Promise<ClipScene> {
  return loadGameMap(mapName, playerMapId).then((map) =>
    Promise.all([
      loadImage(map.imageSrc),
      loadClickableRegions(mapName, playerMapId),
      loadEndCardLogo(),
    ]).then(([image, regions, logo]) => ({
      territories: map.territories,
      seaTerritories: map.seaTerritories,
      bonuses: map.bonuses,
      timedConnections: map.timedConnections,
      directionalConnections: map.directionalConnections,
      switching: {
        switches: map.switches,
        switchedLinks: map.switchedLinks,
      },
      lockedTiles: map.lockedTiles,
      forcedWraps: buildForcedWraps(
        [...map.territories, ...map.seaTerritories],
        map.wraps,
      ),
      regions: regions && { ...regions },
      placeNames: placeNamesFor(mapName),
      image,
      logo,
      imgDims: image
        ? { w: image.naturalWidth, h: image.naturalHeight }
        : { w: DEFAULT_IMAGE_WIDTH, h: DEFAULT_IMAGE_HEIGHT },
    })),
  );
}
