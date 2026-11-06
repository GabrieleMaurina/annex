import { generatedTileGrid, tileSide } from 'engine';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FixedTile,
  GenerateMapInput,
  LockedTile,
} from '../../../lib/types';
import {
  newTerritory,
  nextTerritoryId,
  NO_CONTINENT,
  withoutVertex,
  type EditorTerritory as Territory,
} from '../model/editorTypes';
import {
  drawTileOverlay,
  eraseTiles,
  fillableTiles,
  maskTiles,
  paintAroundTiles,
  regionTiles,
  tileColorIn,
  type TileDecor,
} from './drawTiles';
import {
  placeTileTerritory,
  TILE_FILL,
  tileCenter,
  tileNeighbors,
  toEditorTiles,
  type EditorTile,
  type TileKind,
  type TilePoint,
} from './editorTiles';
import { centeredTile, placeTile } from './snapTiles';

const FOLLOW_TOLERANCE = 0.5;

function tileSideOf(
  sample: TilePoint[] | undefined,
  width: number,
  height: number,
): number {
  if (!sample) return tileSide(width, height);
  const [[ax, ay], [bx, by]] = sample;
  return Math.hypot(bx - ax, by - ay);
}

interface VertexDrag {
  index: number;
  before: number[];
}

interface Options {
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  paintSurface: ImageData;
  generation: GenerateMapInput | null;
  continentId: number;
  continentCount: number;
  borderColor: string;
  onChange: () => void;
  selectedTerritoryId: number | null;
  selectTerritory: (id: number | null) => void;
}

export interface TileOptions {
  kind: TileKind;
  setKind: (kind: TileKind) => void;
  unlockable: boolean;
  setUnlockable: (value: boolean) => void;
}

export type TilesApi = ReturnType<typeof useTiles>;

export function useTiles({
  territories,
  setTerritories,
  paintSurface,
  generation,
  continentId,
  continentCount,
  borderColor,
  onChange,
  selectedTerritoryId,
  selectTerritory,
}: Options) {
  const { width, height } = paintSurface;
  const [list, setList] = useState<EditorTile[]>([]);
  const [kind, setKind] = useState<TileKind>('squares');
  const [unlockable, setDefaultUnlockable] = useState(false);
  const [vertexDrag, setVertexDrag] = useState<VertexDrag | null>(null);
  const [overlay] = useState(() => document.createElement('canvas'));
  const decorRef = useRef<TileDecor | null>(null);
  const unbakeRef = useRef(false);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    }
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const guides = useMemo(() => {
    if (generation?.type !== 'tile') return [];
    const grid = generatedTileGrid(generation);
    return grid.width === width && grid.height === height ? grid.tiles : [];
  }, [generation, width, height]);

  const [prevTerritories, setPrevTerritories] = useState(territories);
  if (territories !== prevTerritories) {
    setPrevTerritories(territories);
    const byId = new Map(territories.map((t) => [t.id, t]));
    let changed = false;
    const next: EditorTile[] = [];
    list.forEach((tile, k) => {
      const vertex = byId.get(tile.territoryId);
      if (!vertex) {
        changed = true;
        return;
      }
      const [cx, cy] = tileCenter(tile.points);
      if (Math.hypot(vertex.x - cx, vertex.y - cy) < FOLLOW_TOLERANCE) {
        next.push(tile);
        return;
      }
      changed = true;
      if (vertexDrag?.index !== k)
        setVertexDrag({
          index: k,
          before: tileNeighbors(list, tile.points, k),
        });
      next.push({
        ...tile,
        points: placeTile(
          list,
          guides,
          centeredTile(tile.points),
          [vertex.x, vertex.y],
          k,
        ),
      });
    });
    if (changed) setList(next);
    if (next.length !== list.length) setVertexDrag(null);
  }

  const found = list.findIndex(
    (tile) => tile.territoryId === selectedTerritoryId,
  );
  const selected = found >= 0 ? found : null;
  useEffect(() => {
    drawTileOverlay(
      overlay,
      width,
      height,
      list,
      selected,
      decorRef.current,
      borderColor,
    );
    onChange();
  }, [overlay, width, height, list, selected, borderColor, onChange]);

  const untiled = useMemo(() => {
    const ids = new Set(list.map((tile) => tile.territoryId));
    return territories.filter((t) => !ids.has(t.id) && !t.switch);
  }, [territories, list]);

  const finishRef = useRef(() => {});
  useEffect(() => {
    finishRef.current = () => {
      if (!vertexDrag) return;
      setVertexDrag(null);
      move(vertexDrag.index, list[vertexDrag.index].points, vertexDrag.before);
    };
  });

  useEffect(() => {
    if (!vertexDrag) return;
    const onUp = () => finishRef.current();
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [vertexDrag]);

  function redraw(decor: TileDecor | null) {
    decorRef.current = decor;
    drawTileOverlay(overlay, width, height, list, selected, decor, borderColor);
    onChange();
  }

  const load = useCallback(
    (lockedTiles: LockedTile[], fixedTiles: FixedTile[]) => {
      setList(toEditorTiles(lockedTiles, fixedTiles));
      unbakeRef.current = fixedTiles.length > 0;
    },
    [],
  );

  function unbake(surface: ImageData) {
    if (!unbakeRef.current) return;
    unbakeRef.current = false;
    eraseTiles(surface, list);
  }

  function select(index: number | null) {
    selectTerritory(index === null ? null : list[index].territoryId);
  }

  function replace(index: number, tile: EditorTile) {
    setList(list.map((t, k) => (k === index ? tile : t)));
  }

  function add(points: TilePoint[]) {
    const id = nextTerritoryId(territories);
    const center = tileCenter(points);
    const vertex = newTerritory(
      id,
      ...center,
      unlockable ? NO_CONTINENT : continentId,
      continentCount,
    );
    setTerritories(
      placeTileTerritory(
        [...territories, { ...vertex, locked: unlockable }],
        id,
        center,
        [],
        tileNeighbors(list, points, null),
      ),
    );
    setList([
      ...list,
      { points, unlockable, territoryId: id, color: TILE_FILL },
    ]);
    selectTerritory(id);
  }

  function move(
    index: number,
    points: TilePoint[],
    before = tileNeighbors(list, list[index].points, index),
  ) {
    const tile = list[index];
    replace(index, { ...tile, points });
    setTerritories(
      placeTileTerritory(
        territories,
        tile.territoryId,
        tileCenter(points),
        before,
        tileNeighbors(list, points, index),
      ),
    );
  }

  function drag(index: number, points: TilePoint[]) {
    const tile = list[index];
    const [x, y] = tileCenter(points);
    replace(index, { ...tile, points });
    setTerritories(
      territories.map((t) => (t.id === tile.territoryId ? { ...t, x, y } : t)),
    );
  }

  function remove(index: number) {
    const id = list[index].territoryId;
    if (index === selected) selectTerritory(null);
    setList(list.filter((_, k) => k !== index));
    setTerritories(withoutVertex(territories, id));
  }

  function toggle(index: number) {
    const tile = list[index];
    const locked = !tile.unlockable;
    replace(index, { ...tile, unlockable: locked });
    setTerritories(
      territories.map((t) =>
        t.id !== tile.territoryId
          ? t
          : locked
            ? { ...t, locked, isSea: false }
            : { ...t, locked },
      ),
    );
  }

  const options: TileOptions = {
    kind,
    setKind,
    unlockable,
    setUnlockable: setDefaultUnlockable,
  };

  return {
    list,
    setList,
    load,
    unbake,
    overlay,
    side: tileSideOf(guides[0] ?? list[0]?.points, width, height),
    guides,
    selected,
    select,
    pointerRef,
    redraw,
    add,
    move,
    drag,
    remove,
    toggle,
    untiled,
    masked: (surface: ImageData) => maskTiles(surface, list, borderColor),
    regions: (surface: ImageData) => regionTiles(surface, list, borderColor),
    paintMasked: (surface: ImageData, paint: (s: ImageData) => boolean) =>
      paintAroundTiles(
        surface,
        maskTiles(surface, list, borderColor),
        list,
        paint,
      )?.changed ?? false,
    paintFilled: (surface: ImageData, paint: (s: ImageData) => boolean) => {
      const result = paintAroundTiles(
        surface,
        fillableTiles(surface, list, borderColor),
        list,
        paint,
      );
      if (!result) return false;
      setList(
        list.map((tile) =>
          tile.unlockable
            ? tile
            : { ...tile, color: tileColorIn(result.work, tile) },
        ),
      );
      return result.changed;
    },
    options,
  };
}
