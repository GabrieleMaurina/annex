import { FLIP_COST, switchStates } from 'engine';
import type { GameState, MapSwitch, SwitchedLink } from '../../lib/types';

type OwnerById = Map<number, GameState['territories'][number]>;

export const SWITCH_WIDTH_RADII = 2.8;
export const SWITCH_HEIGHT_RADII = 1.5;

export function switchVertexId(switchId: number): number {
  return -1 - switchId;
}

export function switchIdOf(vertexId: number): number {
  return -1 - vertexId;
}

export function isSwitchVertex(id: number): boolean {
  return id < 0;
}

export function flipSources(
  switches: MapSwitch[],
  ownerById: OwnerById,
  selfId: number | null,
): Set<number> {
  return new Set(
    switches
      .flatMap((s) => s.neighbors)
      .filter((id) => {
        const owner = ownerById.get(id);
        return owner?.ownerId === selfId && owner.troops >= FLIP_COST + 1;
      }),
  );
}

export function flipTargets(
  switches: MapSwitch[],
  sources: Set<number>,
  startId: number | null,
): number[] {
  if (startId === null || !sources.has(startId)) return [];
  return switches.flatMap((s, i) => (s.neighbors.includes(startId) ? [i] : []));
}

export function switchAt(
  switches: MapSwitch[],
  x: number,
  y: number,
  vertexRadius: number,
): number | null {
  const halfW = (SWITCH_WIDTH_RADII * vertexRadius) / 2;
  const halfH = (SWITCH_HEIGHT_RADII * vertexRadius) / 2;
  const index = switches.findIndex(
    (s) => Math.abs(s.x - x) <= halfW && Math.abs(s.y - y) <= halfH,
  );
  return index < 0 ? null : index;
}

export function switchesOnAfter(
  switches: MapSwitch[],
  flips: number[],
): number[] {
  const flipped = new Set<number>();
  for (const id of flips)
    if (flipped.has(id)) flipped.delete(id);
    else flipped.add(id);
  return switchStates(switches, flipped).flatMap((on, i) => (on ? [i] : []));
}

export interface MapSwitching {
  switches: MapSwitch[];
  switchedLinks: SwitchedLink[];
}

export const NO_SWITCHING: MapSwitching = { switches: [], switchedLinks: [] };
