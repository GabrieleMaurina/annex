import type { GameState } from '../../lib/types';
import type { SeaTerritory } from '../mapData';

export function getAttackSeaStartCandidates(
  seaTerritories: SeaTerritory[],
  seas: GameState['seas'],
  selfId: number | null,
): Set<number> {
  const shipsBySeaId = new Map(seas.map((s) => [s.id, s.ships]));
  const candidates = new Set<number>();
  for (const s of seaTerritories) {
    const ships = shipsBySeaId.get(s.id) ?? [];
    const mine = ships.find((b) => b.playerId === selfId)?.ships ?? 0;
    if (mine < 1) continue;
    if (ships.some((b) => b.playerId !== selfId && b.ships > 0))
      candidates.add(s.id);
  }
  return candidates;
}

export function getSeaDefenders(
  seas: GameState['seas'],
  seaTerritoryId: number,
  selfId: number | null,
): { playerId: number; ships: number }[] {
  const sea = seas.find((s) => s.id === seaTerritoryId);
  return (sea?.ships ?? []).filter((b) => b.playerId !== selfId && b.ships > 0);
}
