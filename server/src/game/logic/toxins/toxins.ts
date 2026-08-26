import { Game } from '../../../types';
import { wouldSplitMap as wouldSplitMapShared } from '../connectivity';
import { nextSetBaseValues } from '../progression/cards';

export function toxinsCost(game: Game, playerId: number): number {
  if (game.toxins === 'off') return Infinity;
  if (game.cards === 'Constant') return game.toxins === 'temporary' ? 5 : 10;
  const base = nextSetBaseValues(game, playerId).mixed;
  return Math.ceil(base * (game.toxins === 'temporary' ? 0.25 : 0.5));
}

export function isFreeConquestTarget(game: Game, territoryId: number): boolean {
  return (
    !game.territoryOwners.has(territoryId) &&
    !game.territoryToxins.has(territoryId) &&
    !game.radiationTerritoryIds.has(territoryId)
  );
}

export function wouldSplitMap(
  game: Game,
  candidateTerritoryId: number,
): boolean {
  return wouldSplitMapShared(
    game,
    new Set([...game.territoryToxins.keys(), ...game.radiationTerritoryIds]),
    candidateTerritoryId,
  );
}

export function decrementToxinsGlobally(game: Game): number[] {
  const expired: number[] = [];
  for (const [territoryId, toxin] of [...game.territoryToxins]) {
    if (toxin.permanent) continue;
    if (toxin.turnsRemaining <= 1) {
      game.territoryToxins.delete(territoryId);
      expired.push(territoryId);
    } else {
      game.territoryToxins.set(territoryId, {
        ...toxin,
        turnsRemaining: toxin.turnsRemaining - 1,
      });
    }
  }
  return expired;
}
