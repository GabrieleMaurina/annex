import {
  isStronglyConnected,
  switchedLinkKeys,
  withEventualLinks,
  withUnlockedTiles,
} from 'engine';
import type {
  DirectionalConnection,
  GameState,
  LockedTile,
  SwitchedLink,
  TimedConnection,
} from '../../lib/types';
import type { SeaTerritory, Territory } from '../mapData';
import { withPortalEdges } from '../portals';

type OwnerById = Map<number, GameState['territories'][number]>;

export interface ScheduledLinks {
  timedConnections: TimedConnection[];
  directionalConnections: DirectionalConnection[];
  switchedLinks: SwitchedLink[];
}

export function toxinsCost(
  toxinsSetting: GameState['toxins'],
  cards: GameState['cards'],
  nextSetBaseValues: GameState['nextSetBaseValues'],
): number {
  if (toxinsSetting === 'off') return Infinity;
  if (cards === 'constant' || cards === 'off')
    return toxinsSetting === 'temporary' ? 5 : 10;
  return Math.ceil(
    nextSetBaseValues.mixed * (toxinsSetting === 'temporary' ? 0.25 : 0.5),
  );
}

export function wouldSplitMap(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  blockedById: Set<number>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  closedTiles: LockedTile[],
  links: ScheduledLinks,
  candidateTerritoryId: number,
): boolean {
  const removed = new Set(blockedById);
  removed.add(candidateTerritoryId);
  const remaining = territories.filter((t) => !removed.has(t.id));
  if (remaining.length === 0) return false;

  const seaIds = new Set(seaTerritories.map((t) => t.id));
  const shoresBySea = new Map(
    seaTerritories.map((t) => [
      t.id,
      t.neighbors.filter((n) => !seaIds.has(n)),
    ]),
  );
  const nodes = withEventualLinks(
    withUnlockedTiles(
      territories,
      closedTiles,
      new Set(closedTiles.map((tile) => tile.id)),
    ),
    links.timedConnections,
    links.directionalConnections,
    switchedLinkKeys(links.switchedLinks),
  );
  const edges = new Map(
    nodes
      .filter((t) => !removed.has(t.id))
      .map((t) => [
        t.id,
        withPortalEdges(t.neighbors, t.id, portalTerritoryIds, portalsEnabled)
          .flatMap((n) => shoresBySea.get(n) ?? [n])
          .filter((n) => !removed.has(n)),
      ]),
  );
  return !isStronglyConnected(
    remaining.map((t) => t.id),
    edges,
  );
}

export function getToxinsCandidates(
  territories: Territory[],
  seaTerritories: SeaTerritory[],
  ownerById: OwnerById,
  selfId: number | null,
  cost: number,
  blockedById: Set<number>,
  upcomingBlockedById: Set<number>,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  closedTiles: LockedTile[],
  links: ScheduledLinks,
): Set<number> {
  const candidates = new Set<number>();
  const ownedCount = territories.filter(
    (t) => ownerById.get(t.id)?.ownerId === selfId,
  ).length;
  if (ownedCount <= 1) return candidates;
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId) continue;
    if (owner.isCapital) continue;
    if (owner.troops < cost) continue;
    if (
      [blockedById, upcomingBlockedById].some((blocked) =>
        wouldSplitMap(
          territories,
          seaTerritories,
          blocked,
          portalTerritoryIds,
          portalsEnabled,
          closedTiles,
          links,
          t.id,
        ),
      )
    )
      continue;
    candidates.add(t.id);
  }
  return candidates;
}
