import { Game } from '../../types';

interface AttackedLogPayload {
  attackerId?: number;
  defenderId?: number;
  defenceLosses?: number;
  conquered?: boolean;
  defendingTerritoryId?: number;
}

interface GrudgeCache {
  length: number;
  byAttacker: Map<number, number>;
}

const grudgeCaches = new WeakMap<object, GrudgeCache>();

function grudges(game: Game, botId: number): Map<number, number> {
  const entries = game.logs.get(botId) ?? [];
  const cached = grudgeCaches.get(entries);
  if (cached && cached.length === entries.length) return cached.byAttacker;
  const byAttacker = new Map<number, number>();
  let index = 0;
  for (const entry of entries) {
    index++;
    if (entry.type !== 'game:attacked') continue;
    const payload = entry.payload as AttackedLogPayload;
    if (payload.attackerId === undefined || payload.defenderId !== botId)
      continue;

    const recencyWeight = 0.5 + 0.5 * (index / entries.length);
    let impact = payload.defenceLosses ?? 0;
    if (payload.conquered) {
      impact += 3;
      if (
        payload.defendingTerritoryId !== undefined &&
        game.capitalTerritoryIds.has(payload.defendingTerritoryId)
      )
        impact += 5;
    }
    byAttacker.set(
      payload.attackerId,
      (byAttacker.get(payload.attackerId) ?? 0) + impact * recencyWeight,
    );
  }
  grudgeCaches.set(entries, { length: entries.length, byAttacker });
  return byAttacker;
}

export function grudgeAgainst(
  game: Game,
  botId: number,
  targetPlayerId: number,
): number {
  return grudges(game, botId).get(targetPlayerId) ?? 0;
}

export function strongestGrudgeTarget(
  game: Game,
  botId: number,
  candidateIds: number[],
): number | null {
  let best: number | null = null;
  let bestGrudge = 0;
  for (const id of candidateIds) {
    const grudge = grudgeAgainst(game, botId, id);
    if (grudge > bestGrudge) {
      bestGrudge = grudge;
      best = id;
    }
  }
  return best;
}
