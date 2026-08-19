import type { Territory } from './mapData';
import type { GameState } from '../lib/types';

type OwnerById = Map<number, GameState['territories'][number]>;

export function getAttackStartCandidates(
  territories: Territory[],
  ownerById: OwnerById,
  selfId: number | null,
): Set<number> {
  const candidates = new Set<number>();
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId || owner.troops < 2) continue;
    if (
      t.neighbors.some((n) => {
        const neighborOwner = ownerById.get(n);
        return neighborOwner && neighborOwner.ownerId !== selfId;
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
): Set<number> {
  const candidates = new Set<number>();
  const territory = territories.find((t) => t.id === startId);
  for (const n of territory?.neighbors ?? []) {
    const owner = ownerById.get(n);
    if (owner && owner.ownerId !== selfId) candidates.add(n);
  }
  return candidates;
}
