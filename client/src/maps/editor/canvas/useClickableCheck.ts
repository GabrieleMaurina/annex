import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { labelRegions, rgbOf } from '../../../game/regions/labelRegions';
import type { EditorTerritory } from '../model/editorTypes';
import { continentColor, SEA_MARKER_COLOR } from '../palette';

const CHECK_DELAY = 400;
const AREA_ALPHA = 140;

export interface ClickableCheck {
  invalidIds: Set<number>;
  overlay: HTMLCanvasElement | null;
}

interface LabeledAreas {
  labels: Int16Array;
  invalidIds: Set<number>;
  width: number;
  height: number;
  territories: EditorTerritory[];
}

function tintOverlay({
  labels,
  invalidIds,
  width,
  height,
  territories,
}: LabeledAreas): HTMLCanvasElement {
  const tintById = new Map(
    territories
      .filter((t) => !invalidIds.has(t.id))
      .map((t) => [
        t.id,
        [
          ...rgbOf(t.isSea ? SEA_MARKER_COLOR : continentColor(t.continentId)),
          AREA_ALPHA,
        ],
      ]),
  );
  const image = new ImageData(width, height);
  for (let i = 0; i < labels.length; i++) {
    const tint = tintById.get(labels[i]);
    if (!tint) continue;
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
  const [labeled, setLabeled] = useState<LabeledAreas | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const surface = surfaceRef.current;
      const { labels, invalidIds } = labelRegions(
        surface,
        territories,
        borderColors,
      );
      setLabeled({
        labels,
        invalidIds,
        width: surface.width,
        height: surface.height,
        territories,
      });
    }, CHECK_DELAY);
    return () => clearTimeout(timer);
  }, [surfaceRef, paintVersion, territories, borderColors]);
  const overlay = useMemo(
    () => (showAreas && labeled ? tintOverlay(labeled) : null),
    [showAreas, labeled],
  );
  return useMemo(
    () => (labeled ? { invalidIds: labeled.invalidIds, overlay } : null),
    [labeled, overlay],
  );
}
