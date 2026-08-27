import type { GameState } from '../../lib/types';
import type { Territory } from '../mapData';

type OwnerById = Map<number, GameState['territories'][number]>;

export function getEntrenchCandidates(
  territories: Territory[],
  ownerById: OwnerById,
  selfId: number | null,
): Set<number> {
  const candidates = new Set<number>();
  for (const t of territories) {
    const owner = ownerById.get(t.id);
    if (!owner || owner.ownerId !== selfId) continue;
    if (owner.isCapital) continue;
    if (owner.troops < 2) continue;
    candidates.add(t.id);
  }
  return candidates;
}
