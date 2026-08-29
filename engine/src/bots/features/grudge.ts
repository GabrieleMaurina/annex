import { Game } from '../../types';

interface AttackedLogPayload {
  attackerId?: number;
  defenderId?: number;
  defenceLosses?: number;
  conquered?: boolean;
  defendingTerritoryId?: number;
}

// Reuses the existing per-player game.logs (populated for every
// game:attacked event by recordLog/fogFilterEmit) instead of tracking any
// new state: scans the bot's own log for attacks it suffered, weighting each
// by troops lost and whether a territory (or capital) was taken, with more
// recent attacks counting more.
export function grudgeAgainst(
  game: Game,
  botId: number,
  targetPlayerId: number,
): number {
  const entries = game.logs.get(botId) ?? [];
  let grudge = 0;
  let index = 0;
  for (const entry of entries) {
    index++;
    if (entry.type !== 'game:attacked') continue;
    const payload = entry.payload as AttackedLogPayload;
    if (payload.attackerId !== targetPlayerId || payload.defenderId !== botId)
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
    grudge += impact * recencyWeight;
  }
  return grudge;
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
