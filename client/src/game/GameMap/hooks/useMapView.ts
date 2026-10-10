import { useEffect, useRef, useState } from 'react';
import type { MapWrap } from '../../../lib/types';
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  loadGameMap,
  type SeaTerritory,
  type Territory,
} from '../../mapData';
import { createCamera, DEFAULT_TRANSFORM } from '../camera';

export function useMapView(mapName: string, playerMapId?: string | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [seaTerritories, setSeaTerritories] = useState<SeaTerritory[]>([]);
  const [bonuses, setBonuses] = useState<number[]>([]);
  const [wraps, setWraps] = useState<MapWrap[]>([]);
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
      ({ territories, seaTerritories, bonuses, wraps, imageSrc }) => {
        setTerritories(territories);
        setSeaTerritories(seaTerritories);
        setBonuses(bonuses);
        setWraps(wraps);
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
    wraps,
    camera,
    imgDims,
    size,
  };
}
