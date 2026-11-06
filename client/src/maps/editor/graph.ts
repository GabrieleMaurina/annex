import {
  isStronglyConnected,
  linkKey,
  MAX_SWITCHES,
  withSeaHops,
} from 'engine';
import type { EditorTerritory as Territory } from './model/editorTypes';

const MIN_CONTINENT_SIZE = 2;
const MAX_CONTINENT_SIZE = 40;

function isStronglyLinked(territories: Territory[]): boolean {
  if (territories.length === 0) return true;
  const switchIds = new Set(
    territories.filter((t) => t.switch).map((t) => t.id),
  );
  const wired = new Set(
    territories.flatMap((t) =>
      (t.switch?.wires ?? []).map((w) => linkKey(w.a, w.b)),
    ),
  );
  const nodes = territories
    .filter((t) => !t.switch)
    .map((t) => ({
      id: t.id,
      neighbors: [
        ...t.neighbors.filter((n) => !switchIds.has(n)),
        ...t.timed.map((m) => m.id),
        ...t.directional
          .filter(
            (m) => m.out || m.backward > 0 || wired.has(linkKey(t.id, m.id)),
          )
          .map((m) => m.id),
      ],
    }));
  const seaIds = new Set(territories.filter((t) => t.isSea).map((t) => t.id));
  const edges = new Map(
    withSeaHops(nodes, seaIds).map((n) => [n.id, n.neighbors]),
  );
  return isStronglyConnected(
    territories
      .filter((t) => !t.isSea && !t.locked && !t.switch)
      .map((t) => t.id),
    edges,
  );
}

function invalidContinentSizes(
  territories: Territory[],
  continentCount: number,
): boolean {
  const size = new Map<number, number>();
  for (const t of territories)
    if (!t.isSea && !t.locked && !t.switch)
      size.set(t.continentId, (size.get(t.continentId) ?? 0) + 1);
  for (let i = 0; i < continentCount; i++) {
    const n = size.get(i) ?? 0;
    if (n < MIN_CONTINENT_SIZE || n > MAX_CONTINENT_SIZE) return true;
  }
  return false;
}

export function graphError(
  territories: Territory[],
  continentCount: number,
): string | null {
  const seaIds = new Set(territories.filter((t) => t.isSea).map((t) => t.id));
  if (
    territories.some(
      (t) =>
        t.locked &&
        (t.timed.length > 0 ||
          t.directional.length > 0 ||
          t.wraps.length > 0 ||
          t.neighbors.some((n) => seaIds.has(n))),
    )
  )
    return 'Unlockable tiles can only have normal links to land territories and other unlockable tiles.';
  const switchTargets = new Set(
    territories
      .filter((t) => !t.isSea && !t.locked && !t.switch)
      .map((t) => t.id),
  );
  const switches = territories.filter((t) => t.switch);
  if (switches.length > MAX_SWITCHES)
    return `A map can have at most ${MAX_SWITCHES} switches.`;
  if (
    switches.some(
      (t) =>
        t.neighbors.length === 0 ||
        t.neighbors.some((n) => !switchTargets.has(n)),
    )
  )
    return 'Every switch must be linked to at least one land territory, and only to land territories.';
  if (switches.some((t) => t.switch!.wires.length === 0))
    return 'Every switch must be wired to at least one timed or directional link.';
  if (!isStronglyLinked(territories))
    return 'Every territory must be able to reach every other territory.';
  if (territories.some((t) => t.isSea && t.timed.length > 0))
    return 'Timed links can only connect two land territories.';
  if (territories.some((t) => t.isSea && t.directional.length > 0))
    return 'Directional links can only connect two land territories.';
  const landIds = new Set(territories.filter((t) => !t.isSea).map((t) => t.id));
  if (
    territories.some((t) => t.isSea && !t.neighbors.some((n) => landIds.has(n)))
  )
    return 'Every sea must border a land territory.';
  if (invalidContinentSizes(territories, continentCount))
    return `Each continent must have ${MIN_CONTINENT_SIZE}-${MAX_CONTINENT_SIZE} territories.`;
  return null;
}
