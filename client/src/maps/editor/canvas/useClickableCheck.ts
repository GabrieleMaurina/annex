import { useEffect, useState, type MutableRefObject } from 'react';
import { labelRegions } from '../../../game/regions/labelRegions';
import type { EditorTerritory } from '../model/editorTypes';

const CHECK_DELAY = 400;
const VALID_TINT = [25, 135, 84, 140];
const INVALID_TINT = [220, 53, 69, 170];

export interface ClickableCheck {
  invalidIds: Set<number>;
  overlay: HTMLCanvasElement | null;
}

function tintOverlay(
  labels: Int16Array,
  invalidIds: Set<number>,
  width: number,
  height: number,
): HTMLCanvasElement {
  const image = new ImageData(width, height);
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] < 0) continue;
    const tint = invalidIds.has(labels[i]) ? INVALID_TINT : VALID_TINT;
    const o = i * 4;
    image.data[o] = tint[0];
    image.data[o + 1] = tint[1];
    image.data[o + 2] = tint[2];
    image.data[o + 3] = tint[3];
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas;
}

export function useClickableCheck(
  surfaceRef: MutableRefObject<ImageData>,
  paintVersion: number,
  territories: EditorTerritory[],
  borderColors: string[],
  showAreas: boolean,
): ClickableCheck | null {
  const [check, setCheck] = useState<ClickableCheck | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const surface = surfaceRef.current;
      const { labels, invalidIds } = labelRegions(
        surface,
        territories,
        borderColors,
      );
      setCheck({
        invalidIds,
        overlay: showAreas
          ? tintOverlay(labels, invalidIds, surface.width, surface.height)
          : null,
      });
    }, CHECK_DELAY);
    return () => clearTimeout(timer);
  }, [surfaceRef, paintVersion, territories, borderColors, showAreas]);
  return check;
}
