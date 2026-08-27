import type { GameState } from '../../lib/types';
import type { Territory } from '../mapData';
import { withPortalEdges } from '../portals';

type OwnerById = Map<number, GameState['territories'][number]>;

export function getAttackStartCandidates(
  territories: Territory[],
  ownerById: OwnerById,
  selfId: number | null,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  toxinById: Set<number>,
): Set<number> {
  const candidates = new Set<number>();
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId || owner.troops < 2) continue;
    const neighbors = withPortalEdges(
      t.neighbors,
      t.id,
      portalTerritoryIds,
      portalsEnabled,
    );
    if (
      neighbors.some((n) => {
        const neighborOwner = ownerById.get(n);
        if (neighborOwner) return neighborOwner.ownerId !== selfId;
        return !toxinById.has(n);
      })
    ) {
      candidates.add(t.id);
    }
  }
  return candidates;
}

export function getAttackEndCandidates(
  territories: Territory[],
  ownerById: OwnerById,
  selfId: number | null,
  startId: number,
  portalTerritoryIds: number[],
  portalsEnabled: boolean,
  toxinById: Set<number>,
): Set<number> {
  const candidates = new Set<number>();
  const territory = territories.find((t) => t.id === startId);
  const neighbors = withPortalEdges(
    territory?.neighbors ?? [],
    startId,
    portalTerritoryIds,
    portalsEnabled,
  );
  for (const n of neighbors) {
    const owner = ownerById.get(n);
    if (owner) {
      if (owner.ownerId !== selfId) candidates.add(n);
    } else if (!toxinById.has(n)) {
      candidates.add(n);
    }
  }
  return candidates;
}
