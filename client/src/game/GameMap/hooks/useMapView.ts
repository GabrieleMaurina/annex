import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  loadGameMap,
  type Territory,
} from '../../mapData';
import type { Transform } from '../helpers';

export function useMapView(mapName: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [bonuses, setBonuses] = useState<number[]>([]);
  const [transform, setTransform] = useState<Transform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [imgDims, setImgDims] = useState({
    w: DEFAULT_IMAGE_WIDTH,
    h: DEFAULT_IMAGE_HEIGHT,
  });
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    loadGameMap(mapName).then(({ territories, bonuses, imageSrc }) => {
      setTerritories(territories);
      setBonuses(bonuses);
      setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
      if (!imageSrc) {
        imageRef.current = null;
        setImgDims({ w: DEFAULT_IMAGE_WIDTH, h: DEFAULT_IMAGE_HEIGHT });
        return;
      }
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
        setTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
      };
      img.src = imageSrc;
    });
  }, [mapName]);

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
    bonuses,
    transform,
    setTransform,
    imgDims,
    size,
  };
}
