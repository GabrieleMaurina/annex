import { useEffect, useMemo, useState } from 'react';
import type { EditorTerritory } from '../model/editorTypes';
import { DEFAULT_CELL_SCALE, drawTerritoryBorders } from './drawTerritories';
import {
  previewBorders,
  previewGrid,
  type PreviewGrid,
} from './previewBorders';

const GRID_DELAY = 150;

export interface TerritoryBorders {
  cellScale: number;
  setCellScale: (value: number) => void;
  preview: boolean;
  setPreview: (value: boolean) => void;
  overlay: HTMLCanvasElement | null;
  draw: (surface: ImageData) => boolean;
}

export function useTerritoryBorders(
  surface: ImageData,
  paintVersion: number,
  territories: EditorTerritory[],
  borderColors: string[],
  brushSize: number,
  dotted: boolean,
): TerritoryBorders {
  const [cellScale, setCellScale] = useState(DEFAULT_CELL_SCALE);
  const [preview, setPreview] = useState(false);
  const [grid, setGrid] = useState<PreviewGrid | null>(null);

  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(
      () => setGrid(previewGrid(surface, borderColors)),
      GRID_DELAY,
    );
    return () => clearTimeout(timer);
  }, [preview, surface, paintVersion, borderColors]);

  const fittingGrid =
    grid?.imageWidth === surface.width && grid.imageHeight === surface.height
      ? grid
      : null;
  const overlay = useMemo(
    () =>
      preview && fittingGrid
        ? previewBorders(fittingGrid, territories, cellScale)
        : null,
    [preview, fittingGrid, territories, cellScale],
  );

  return {
    cellScale,
    setCellScale,
    preview,
    setPreview: (value) => {
      setPreview(value);
      if (!value) setGrid(null);
    },
    overlay,
    draw: (target) =>
      drawTerritoryBorders(
        target,
        territories,
        borderColors,
        brushSize,
        cellScale,
        dotted,
      ),
  };
}
