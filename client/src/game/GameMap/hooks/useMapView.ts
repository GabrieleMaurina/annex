import { useEffect, useMemo, useRef, useState } from 'react';
import type { LockedTile, MapWrap, TimedConnection } from '../../../lib/types';
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  loadGameMap,
  type SeaTerritory,
  type Territory,
} from '../../mapData';
import { buildForcedWraps } from '../../mapMath';
import {
  loadClickableRegions,
  type ClickableRegions,
} from '../../regions/clickableRegions';
import { createCamera, DEFAULT_TRANSFORM } from '../camera';

export function useMapView(mapName: string, playerMapId?: string | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [seaTerritories, setSeaTerritories] = useState<SeaTerritory[]>([]);
  const [bonuses, setBonuses] = useState<number[]>([]);
  const [wraps, setWraps] = useState<MapWrap[]>([]);
  const [timedConnections, setTimedConnections] = useState<TimedConnection[]>(
    [],
  );
  const [lockedTiles, setLockedTiles] = useState<LockedTile[]>([]);
  const [regions, setRegions] = useState<ClickableRegions | null>(null);
  const [camera] = useState(createCamera);
  const [imgDims, setImgDims] = useState({
    w: DEFAULT_IMAGE_WIDTH,
    h: DEFAULT_IMAGE_HEIGHT,
  });
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    loadGameMap(mapName, playerMapId).then(
      ({
        territories,
        seaTerritories,
        bonuses,
        wraps,
        timedConnections,
        lockedTiles,
        imageSrc,
      }) => {
        setTerritories(territories);
        setSeaTerritories(seaTerritories);
        setBonuses(bonuses);
        setWraps(wraps);
        setTimedConnections(timedConnections);
        setLockedTiles(lockedTiles);
        loadClickableRegions(mapName, playerMapId).then(setRegions);
        camera.set({ ...DEFAULT_TRANSFORM });
        if (!imageSrc) {
          imageRef.current = null;
          setImgDims({ w: DEFAULT_IMAGE_WIDTH, h: DEFAULT_IMAGE_HEIGHT });
          return;
        }
        const img = new Image();
        img.onload = () => {
          imageRef.current = img;
          setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
          camera.set({ ...DEFAULT_TRANSFORM });
        };
        img.src = imageSrc;
      },
    );
  }, [mapName, playerMapId, camera]);

  const forcedWraps = useMemo(
    () => buildForcedWraps([...territories, ...seaTerritories], wraps),
    [territories, seaTerritories, wraps],
  );

  useEffect(() => {
    function onResize() {
      setSize({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    canvasRef,
    imageRef,
    territories,
    seaTerritories,
    bonuses,
    timedConnections,
    lockedTiles,
    forcedWraps,
    regions,
    camera,
    imgDims,
    size,
  };
}
