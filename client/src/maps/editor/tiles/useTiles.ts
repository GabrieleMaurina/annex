import { continentTileTone, generatedTileGrid, tileSide } from 'engine';
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
import { wallColorsOf } from '../model/wallColors';
import {
  eraseTiles,
  fillableTiles,
  maskTiles,
  paintAroundTiles,
  regionTiles,
  tileColorIn,
  type TileDecor,
} from './drawTiles';
import {
  alignToTiles,
  placeTileTerritory,
  remapTiles,
  seamEdges,
  TILE_FILL,
  tileCenter,
  tileNeighbors,
  toEditorTiles,
  type EditorTile,
  type TileKind,
  type TilePoint,
  type TileSlot,
} from './editorTiles';
import { centeredTile, contains, placeTile } from './snapTiles';
import { tileFreeCheck } from './tileFree';
import {
  changedRegion,
  drawGhostLayer,
  drawTileLayer,
  type Drawn,
  type Rect,
  type TileLook,
} from './tileRaster';

const FOLLOW_TOLERANCE = 0.5;
const NO_TERRITORIES: Territory[] = [];

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
  borderColors: string[];
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
  borderColors,
  onChange,
  selectedTerritoryId,
  selectTerritory,
}: Options) {
  const { width, height } = paintSurface;
  const wallColor = wallColorsOf(generation, borderColors)[0];
  const generated = generation?.type === 'tile';
  const [list, setList] = useState<EditorTile[]>([]);
  const [kind, setKind] = useState<TileKind>('squares');
  const [unlockable, setDefaultUnlockable] = useState(false);
  const [vertexDrag, setVertexDrag] = useState<VertexDrag | null>(null);
  const [overlay] = useState(() => document.createElement('canvas'));
  const [ghostOverlay] = useState(() => document.createElement('canvas'));
  const drawnRef = useRef<Drawn | null>(null);
  const ghostRectRef = useRef<Rect | null>(null);
  const unbakeRef = useRef(false);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    }
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const grid = useMemo(() => {
    if (generation?.type !== 'tile') return [];
    const laid = generatedTileGrid(generation);
    return laid.width === width && laid.height === height ? laid.tiles : [];
  }, [generation, width, height]);

  const guides = useMemo<TileSlot[]>(() => {
    const owned = new Set(list.map((tile) => tile.territoryId));
    const bare = territories.filter(
      (t) => !t.isSea && !t.locked && !t.switch && !owned.has(t.id),
    );
    return grid.flatMap((points) => {
      const vertex = bare.find((t) => contains(points, [t.x, t.y]));
      return vertex ? [{ points, territoryId: vertex.id }] : [];
    });
  }, [grid, list, territories]);
  const slots = [...list, ...guides];

  const styled = generated && borderColors.length >= 3;
  const seamSource = styled ? territories : NO_TERRITORIES;
  const look = useMemo<TileLook>(
    () =>
      styled
        ? {
            wall: borderColors[1],
            seam: borderColors[2],
            seams: seamEdges(list, seamSource),
          }
        : { wall: wallColor, seam: wallColor, seams: [] },
    [styled, borderColors, wallColor, list, seamSource],
  );

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
          before: tileNeighbors(slots, tile.points, k),
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
    const next = { tiles: list, selected, look, width, height };
    const drew = drawTileLayer(
      overlay,
      width,
      height,
      list,
      selected,
      look,
      changedRegion(drawnRef.current, next),
    );
    drawnRef.current = next;
    if (drew) onChange();
  }, [overlay, width, height, list, selected, look, onChange]);

  const untiled = useMemo(() => {
    const ids = new Set(list.map((tile) => tile.territoryId));
    return territories.filter((t) => !ids.has(t.id) && !t.switch);
  }, [territories, list]);

  function redraw(decor: TileDecor | null) {
    ghostRectRef.current = drawGhostLayer(
      ghostOverlay,
      width,
      height,
      decor?.ghosts ?? [],
      look.wall,
      ghostRectRef.current,
    );
    onChange();
  }

  const load = useCallback(
    (
      map: { lockedTiles: LockedTile[]; fixedTiles: FixedTile[] },
      idMap?: Map<number, number>,
    ) => {
      const built = toEditorTiles(map.lockedTiles, map.fixedTiles);
      const loaded = idMap ? remapTiles(built, idMap) : built;
      setList(loaded);
      setTerritories((current) => alignToTiles(current, loaded));
      unbakeRef.current = loaded.some((tile) => !tile.unlockable);
    },
    [setTerritories],
  );

  function unbake(surface: ImageData) {
    if (!unbakeRef.current) return;
    unbakeRef.current = false;
    eraseTiles(surface, list, generated);
  }

  function neighborsOf(index: number): number[] {
    return tileNeighbors(slots, list[index].points, index);
  }

  function select(index: number | null) {
    selectTerritory(index === null ? null : list[index].territoryId);
  }

  function replace(index: number, tile: EditorTile) {
    setList(list.map((t, k) => (k === index ? tile : t)));
  }

  function add(all: TilePoint[][]) {
    let nextTerritories = territories;
    const added: EditorTile[] = [];
    for (const points of all) {
      const id = nextTerritoryId(nextTerritories);
      const center = tileCenter(points);
      const vertex = newTerritory(
        id,
        ...center,
        unlockable ? NO_CONTINENT : continentId,
        continentCount,
      );
      nextTerritories = placeTileTerritory(
        [...nextTerritories, { ...vertex, locked: unlockable }],
        id,
        center,
        [],
        tileNeighbors([...list, ...added, ...guides], points, null),
      );
      added.push({
        points,
        unlockable,
        territoryId: id,
        color: styled ? continentTileTone(continentId) : TILE_FILL,
      });
    }
    setTerritories(nextTerritories);
    setList([...list, ...added]);
    selectTerritory(added[added.length - 1].territoryId);
  }

  function freeCheck() {
    const owned = new Set(list.map((tile) => tile.territoryId));
    return tileFreeCheck(
      list,
      territories.filter((t) => !owned.has(t.id)),
      paintSurface,
      generated,
    );
  }

  function move(
    index: number,
    points: TilePoint[],
    before = neighborsOf(index),
  ) {
    const tile = list[index];
    replace(index, { ...tile, points });
    setTerritories(
      placeTileTerritory(
        territories,
        tile.territoryId,
        tileCenter(points),
        before,
        tileNeighbors(slots, points, index),
      ),
    );
  }

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
    ghostOverlay,
    side: tileSideOf(list[0]?.points ?? guides[0]?.points, width, height),
    guides,
    look,
    neighborsOf,
    selected,
    select,
    pointerRef,
    redraw,
    add,
    freeCheck,
    move,
    drag,
    remove,
    toggle,
    untiled,
    masked: (surface: ImageData) => maskTiles(surface, list, wallColor),
    regions: (surface: ImageData) => regionTiles(surface, list, wallColor),
    paintMasked: (surface: ImageData, paint: (s: ImageData) => boolean) =>
      paintAroundTiles(
        surface,
        maskTiles(surface, list, wallColor),
        list,
        paint,
      )?.changed ?? false,
    paintFilled: (surface: ImageData, paint: (s: ImageData) => boolean) => {
      const result = paintAroundTiles(
        surface,
        fillableTiles(surface, list, wallColor),
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
