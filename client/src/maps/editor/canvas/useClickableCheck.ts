import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { rgbOf } from '../../../game/regions/labelRegions';
import { polygonPath } from '../../../game/tiles/tileGeometry';
import type { EditorTerritory } from '../model/editorTypes';
import { regionVertices } from '../model/switches';
import { continentColor, SEA_MARKER_COLOR } from '../palette';
import { maskTiles } from '../tiles/drawTiles';
import type { EditorTile } from '../tiles/editorTiles';
import type { ClickableReply, ClickableRequest } from './clickableWorker';

const CHECK_DELAY = 400;
const AREA_ALPHA = 140;

export interface ClickableCheck {
  validCount: number;
  overlay: HTMLCanvasElement | null;
}

interface LabeledAreas {
  labels: Int16Array;
  invalidIds: Set<number>;
  width: number;
  height: number;
  territories: EditorTerritory[];
  tiles: EditorTile[];
}

function markerOf(t: EditorTerritory): string {
  return t.isSea ? SEA_MARKER_COLOR : continentColor(t.continentId);
}

function tintOverlay({
  labels,
  invalidIds,
  width,
  height,
  territories,
  tiles,
}: LabeledAreas): HTMLCanvasElement {
  const tintById = new Map(
    territories
      .filter((t) => !invalidIds.has(t.id))
      .map((t) => [t.id, [...rgbOf(markerOf(t)), AREA_ALPHA]]),
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
  const ctx = canvas.getContext('2d');
  ctx?.putImageData(image, 0, 0);
  if (!ctx) return canvas;
  const byId = new Map(territories.map((t) => [t.id, t]));
  ctx.globalAlpha = AREA_ALPHA / 255;
  for (const tile of tiles) {
    const t = byId.get(tile.territoryId);
    if (!t) continue;
    ctx.fillStyle = markerOf(t);
    ctx.fill(polygonPath(tile.points));
  }
  return canvas;
}

export function useClickableCheck(
  surfaceRef: MutableRefObject<ImageData>,
  paintVersion: number,
  territories: EditorTerritory[],
  borderColors: string[],
  showAreas: boolean,
  tiles: EditorTile[],
): ClickableCheck | null {
  const [labeled, setLabeled] = useState<LabeledAreas | null>(null);
  useEffect(() => {
    let worker: Worker | null = null;
    const timer = setTimeout(() => {
      const vertices = regionVertices(territories);
      const surface = maskTiles(surfaceRef.current, tiles, borderColors[0]);
      const tileIds = new Set(tiles.map((tile) => tile.territoryId));
      worker = new Worker(new URL('./clickableWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.addEventListener(
        'message',
        (event: MessageEvent<ClickableReply>) => {
          worker?.terminate();
          setLabeled({
            labels: event.data.labels,
            invalidIds: new Set(
              event.data.invalidIds.filter((id) => !tileIds.has(id)),
            ),
            width: surface.width,
            height: surface.height,
            territories: vertices,
            tiles,
          });
        },
      );
      const request: ClickableRequest = {
        image: surface,
        points: vertices.map(({ id, x, y, isSea }) => ({ id, x, y, isSea })),
        borderColors,
      };
      worker.postMessage(request);
    }, CHECK_DELAY);
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [surfaceRef, paintVersion, territories, borderColors, tiles]);
  const overlay = useMemo(
    () => (showAreas && labeled ? tintOverlay(labeled) : null),
    [showAreas, labeled],
  );
  return useMemo(
    () =>
      labeled
        ? {
            validCount: labeled.territories.filter(
              (t) => !labeled.invalidIds.has(t.id),
            ).length,
            overlay,
          }
        : null,
    [labeled, overlay],
  );
}
