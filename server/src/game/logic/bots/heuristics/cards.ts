import { Card, Game } from '../../../../types';
import { pickBestSet } from '../../progression/cards';

export function chooseCardSet(
  game: Game,
  botId: number,
): (number | null)[] | null {
  const hand = game.playerCards.get(botId) ?? [];
  const forced = hand.length >= 5;
  const best = pickBestSet(game, hand, botId);
  if (!best) return null;
  if (!forced && hand.length < 3) return null;
  return best.cards.map((c: Card) => c.territoryId);
}
