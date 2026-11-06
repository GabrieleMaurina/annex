import { linkKey } from 'engine';
import type {
  DirectionalConnection,
  LockedTile,
  MapSeaTerritory,
  MapSwitch,
  MapTerritory,
  MapWrap,
  SwitchedLink,
  SwitchGate,
  TimedConnection,
} from '../../../lib/types';
import { tileCenter } from '../tiles/editorTiles';

export interface WrapMark {
  id: number;
  x: boolean;
  y: boolean;
}

export interface TimedMark {
  id: number;
  delay: number;
  open: number;
  closed: number;
  gate: SwitchGate;
}

export interface DirectionalMark {
  id: number;
  out: boolean;
  forward: number;
  backward: number;
  gate: SwitchGate;
}

export interface SwitchWire {
  a: number;
  b: number;
}

export interface EditorSwitch {
  on: boolean;
  wires: SwitchWire[];
}

export interface EditorTerritory extends MapTerritory {
  name: string;
  isSea?: boolean;
  locked?: boolean;
  switch?: EditorSwitch;
  wraps: WrapMark[];
  timed: TimedMark[];
  directional: DirectionalMark[];
}

export type LinkMode = 'select' | 'normal' | 'timed' | 'directional' | 'switch';

export function linkModeOf(tool: string | null): LinkMode {
  if (tool === 'territory') return 'normal';
  return tool === 'timed' || tool === 'directional' || tool === 'switch'
    ? tool
    : 'select';
}

export const DEFAULT_GATE: SwitchGate = 'or';
export const DEFAULT_TIMED = {
  delay: 0,
  open: 1,
  closed: 1,
  gate: DEFAULT_GATE,
};
export const DEFAULT_DIRECTIONAL = {
  forward: 1,
  backward: 1,
  gate: DEFAULT_GATE,
};

export const NO_CONTINENT = -1;
export const SEA_BRUSH = -2;
export const SWITCH_BRUSH = -3;

export function nextTerritoryId(territories: EditorTerritory[]): number {
  return territories.length ? Math.max(...territories.map((t) => t.id)) + 1 : 0;
}

export function newTerritory(
  id: number,
  x: number,
  y: number,
  brushId: number,
  continentCount: number,
): EditorTerritory {
  const isSea = brushId === SEA_BRUSH;
  const base = {
    id,
    x,
    y,
    neighbors: [],
    name: '',
    wraps: [],
    timed: [],
    directional: [],
  };
  if (brushId === SWITCH_BRUSH)
    return {
      ...base,
      continentId: NO_CONTINENT,
      switch: { on: false, wires: [] },
    };
  return {
    ...base,
    continentId: isSea ? 0 : Math.min(brushId, continentCount - 1),
    isSea,
  };
}

export function nextInContinentCycle(
  current: number,
  continentCount: number,
): number {
  if (current === SEA_BRUSH) return continentCount > 0 ? 0 : NO_CONTINENT;
  if (current === NO_CONTINENT) return SEA_BRUSH;
  if (current + 1 >= continentCount) return NO_CONTINENT;
  return current + 1;
}

export function toEditorTerritories(
  territories: MapTerritory[],
  seaTerritories: MapSeaTerritory[],
  wraps: MapWrap[],
  links: {
    timedConnections: TimedConnection[];
    directionalConnections: DirectionalConnection[];
    switches: MapSwitch[];
    switchedLinks: SwitchedLink[];
    lockedTiles: LockedTile[];
  },
  territoryNames: string[] | null,
  seaNames: string[] | null,
): EditorTerritory[] {
  const marksOf = (id: number): WrapMark[] =>
    wraps.flatMap((w) => {
      if (w.a === id) return [{ id: w.b, x: w.x, y: w.y }];
      if (w.b === id) return [{ id: w.a, x: w.x, y: w.y }];
      return [];
    });
  const gates = new Map(
    links.switchedLinks.map((link) => [linkKey(link.a, link.b), link.gate]),
  );
  const gateOf = (a: number, b: number) =>
    gates.get(linkKey(a, b)) ?? DEFAULT_GATE;
  const timedOf = (id: number): TimedMark[] =>
    links.timedConnections.flatMap(({ a, b, ...values }) => {
      const gate = gateOf(a, b);
      if (a === id) return [{ id: b, ...values, gate }];
      if (b === id) return [{ id: a, ...values, gate }];
      return [];
    });
  const directionalOf = (id: number): DirectionalMark[] =>
    links.directionalConnections.flatMap(
      ({ a, b, ...values }): DirectionalMark[] => {
        const gate = gateOf(a, b);
        if (a === id) return [{ id: b, out: true, ...values, gate }];
        if (b === id) return [{ id: a, out: false, ...values, gate }];
        return [];
      },
    );
  const lockedOf = (id: number) =>
    links.lockedTiles
      .filter((tile) => tile.neighbors.includes(id))
      .map((tile) => tile.id);
  const firstSwitchId =
    Math.max(
      -1,
      ...[...territories, ...seaTerritories, ...links.lockedTiles].map(
        (t) => t.id,
      ),
    ) + 1;
  const switchesOf = (id: number) =>
    links.switches.flatMap((s, i) =>
      s.neighbors.includes(id) ? [firstSwitchId + i] : [],
    );
  return [
    ...territories.map((t, i) => ({
      ...t,
      neighbors: [...t.neighbors, ...lockedOf(t.id), ...switchesOf(t.id)],
      name: territoryNames?.[i] ?? '',
      wraps: marksOf(t.id),
      timed: timedOf(t.id),
      directional: directionalOf(t.id),
    })),
    ...seaTerritories.map((s, i) => ({
      ...s,
      continentId: 0,
      name: seaNames?.[i] ?? '',
      isSea: true,
      wraps: marksOf(s.id),
      timed: timedOf(s.id),
      directional: directionalOf(s.id),
    })),
    ...links.lockedTiles.map((tile) => {
      const [x, y] = tileCenter(tile.points);
      return {
        id: tile.id,
        continentId: NO_CONTINENT,
        x,
        y,
        neighbors: tile.neighbors,
        name: '',
        wraps: [],
        timed: [],
        directional: [],
        locked: true,
      };
    }),
    ...links.switches.map((s, i) => ({
      id: firstSwitchId + i,
      continentId: NO_CONTINENT,
      x: s.x,
      y: s.y,
      neighbors: s.neighbors,
      name: '',
      wraps: [],
      timed: [],
      directional: [],
      switch: {
        on: s.on,
        wires: links.switchedLinks
          .filter((link) => link.switches.includes(i))
          .map(({ a, b }) => ({ a, b })),
      },
    })),
  ];
}

export function withContinent(
  territories: EditorTerritory[],
  id: number,
  continentId: number,
): EditorTerritory[] {
  return territories.map((t) =>
    t.id !== id || t.locked || t.switch
      ? t
      : continentId === SEA_BRUSH
        ? { ...t, isSea: true }
        : { ...t, continentId, isSea: false },
  );
}

export function withoutVertex(
  territories: EditorTerritory[],
  id: number,
): EditorTerritory[] {
  return territories
    .filter((t) => t.id !== id)
    .map((t) => ({
      ...t,
      neighbors: t.neighbors.filter((n) => n !== id),
      wraps: t.wraps.filter((w) => w.id !== id),
      timed: t.timed.filter((m) => m.id !== id),
      directional: t.directional.filter((m) => m.id !== id),
      switch: t.switch && {
        ...t.switch,
        wires: t.switch.wires.filter((w) => w.a !== id && w.b !== id),
      },
    }));
}

export function allPlaceNames(
  territories: EditorTerritory[],
  continentNames: string[],
): string[] {
  return [...territories.map((t) => t.name), ...continentNames].map((n) =>
    n.trim(),
  );
}
