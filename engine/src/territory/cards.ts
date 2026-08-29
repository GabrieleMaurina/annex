import { callbacks } from '../callbacks';
import {
  counterKey,
  evaluateCardSelection,
  returnCardsToDeck,
} from '../game/progression/cards';
import { bumpStat } from '../game/progression/stats';
import { recordReplayFrame } from '../game/replay';
import { fogFilterEmit, recordLogForAll } from '../game/world/fog';
import { visibleTerritoryIdsOrAll } from '../game/world/visibility';
import { GameResponse, requireGame } from '../session/context';
import { respondGameState, sendPlayerCards } from '../session/store';

function isNullableInteger(value: unknown): value is number | null {
  return value === null || Number.isInteger(value);
}

function isCardSelection(value: unknown): value is (number | null)[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((c) => isNullableInteger(c))
  );
}

export function requestCards(playerId: number): void {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return;
  const { game } = ctx;
  if (game.state !== 'playing') return;
  sendPlayerCards(game, playerId);
}

export function playCardSet(playerId: number, rawCards: unknown): GameResponse {
  const ctx = requireGame(playerId);
  if (!ctx.ok) return ctx;
  const { game } = ctx;
  if (game.state !== 'playing') return { ok: false, error: 'game not started' };
  if (game.paused) return { ok: false, error: 'game paused' };
  if (game.playerIds[game.turnPlayerIndex] !== playerId)
    return { ok: false, error: 'not your turn' };
  if (game.turnPhase !== 'deploy')
    return { ok: false, error: 'not deploy phase' };
  if (!isCardSelection(rawCards)) return { ok: false, error: 'invalid cards' };
  const cards = rawCards;

  const hand = game.playerCards.get(playerId) ?? [];
  const evaluated = evaluateCardSelection(game, hand, playerId, cards);
  if (!evaluated) return { ok: false, error: 'invalid set' };

  for (const used of evaluated.cards) {
    const index = hand.indexOf(used);
    if (index !== -1) hand.splice(index, 1);
  }
  returnCardsToDeck(game.deck, evaluated.cards);
  sendPlayerCards(game, playerId);

  game.troopsToDeploy += evaluated.baseValue;
  for (const territoryId of evaluated.territoryBonusIds) {
    game.territoryTroops.set(
      territoryId,
      (game.territoryTroops.get(territoryId) ?? 0) + 2,
    );
    recordReplayFrame(game, {
      type: 'deploy',
      territoryId,
      troops: 2,
      playerId,
    });
  }
  const key = counterKey(game, playerId);
  game.cardSetsPlayed.set(key, (game.cardSetsPlayed.get(key) ?? 0) + 1);
  bumpStat(game, playerId, 'setsPlayed');
  bumpStat(
    game,
    playerId,
    'troopsGained',
    evaluated.territoryBonusIds.length * 2,
  );
  if (game.cards === 'Exponential' || game.cards === 'Exponential Per Player')
    game.cardsLastSetValue.set(key, evaluated.baseValue);

  const cardSetPlayedPayload = {
    playerId,
    troops: evaluated.totalValue,
    cards: evaluated.cards,
    territoryBonusCount: evaluated.territoryBonusIds.length,
  };
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onCardSetPlayed(viewerId, cardSetPlayedPayload);
  }
  recordLogForAll(game, 'game:cardSetPlayed', cardSetPlayedPayload);
  for (const territoryId of evaluated.territoryBonusIds) {
    fogFilterEmit(game, 'game:deployed', callbacks.onDeployed, (viewerId) => {
      const visible = visibleTerritoryIdsOrAll(game, viewerId);
      if (visible !== null && !visible.has(territoryId)) return null;
      return { territoryId, troops: 2, playerId };
    });
  }

  return respondGameState(game, playerId);
}
