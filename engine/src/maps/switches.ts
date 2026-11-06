import { MapSwitch, SwitchedLink } from '../types';

export const FLIP_COST = 2;
export const MAX_SWITCHES = 50;
const NO_SWITCHED_LINKS: ReadonlyMap<string, boolean> = new Map();

export function linkKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function switchStates(
  switches: MapSwitch[],
  flippedIds: ReadonlySet<number>,
): boolean[] {
  return switches.map((s, i) => s.on !== flippedIds.has(i));
}

function isSwitchedOn(link: SwitchedLink, states: boolean[]): boolean {
  return link.gate === 'and'
    ? link.switches.every((i) => states[i])
    : link.switches.some((i) => states[i]);
}

export function switchedLinkStates(
  switchedLinks: SwitchedLink[],
  states: boolean[],
): ReadonlyMap<string, boolean> {
  if (switchedLinks.length === 0) return NO_SWITCHED_LINKS;
  return new Map(
    switchedLinks.map((link) => [
      linkKey(link.a, link.b),
      isSwitchedOn(link, states),
    ]),
  );
}

export function switchedLinkKeys(switchedLinks: SwitchedLink[]): Set<string> {
  return new Set(switchedLinks.map((link) => linkKey(link.a, link.b)));
}
