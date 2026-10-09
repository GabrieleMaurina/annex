import { pickBestSet, upcomingSetValues } from '../../game/progression/cards';
import { Card, CardSymbol, Game } from '../../types';

export const FORCED_HAND = 5;
const CARDS_PER_SET = 3;
const CONSTANT_FORCED_SET = 8;
const SET_ODDS_BY_HAND = [0, 0, 0, 0.35, 0.8];
const TURN_DISCOUNT = 0.85;
const EXPONENTIAL_TURN_DISCOUNT = 0.92;
const DRAW_ODDS = 0.9;
const LOOKAHEAD_TURNS = 2;
const SYMBOLS: CardSymbol[] = ['soldier', 'humvee', 'tank'];

interface Outlook {
  discount: number;
  game: Game;
  botId: number;
  values: number[];
  ownTrade: number;
  rivalTrades: number;
  wildOdds: number;
}

function isEscalating(game: Game): boolean {
  return game.cards !== 'constant' && game.cards !== 'off';
}

function isShared(game: Game): boolean {
  return game.cards === 'linear' || game.cards === 'exponential';
}

function handOf(game: Game, playerId: number): Card[] {
  return game.playerCards.get(playerId) ?? [];
}

export function expectedTrades(cards: number): number {
  if (cards >= FORCED_HAND) return Math.floor((cards - 2) / 3);
  return SET_ODDS_BY_HAND[cards] ?? 0;
}

function rivalTradesPerRound(game: Game, botId: number): number {
  if (!isShared(game)) return 0;
  const dead = new Set(game.deathOrder);
  return game.playerIds
    .filter((id) => id !== botId && !dead.has(id))
    .reduce((sum, id) => sum + expectedTrades(handOf(game, id).length), 0);
}

function outlookFor(game: Game, botId: number): Outlook {
  const rivalTrades = rivalTradesPerRound(game, botId);
  const horizon = Math.ceil((rivalTrades + 1) * LOOKAHEAD_TURNS) + 2;
  return {
    game,
    botId,
    values: upcomingSetValues(game, botId, horizon),
    ownTrade: isEscalating(game) ? 1 : 0,
    rivalTrades,
    wildOdds: 2 / (game.territoryOwners.size + 2),
    discount:
      game.cards === 'exponential' ? EXPONENTIAL_TURN_DISCOUNT : TURN_DISCOUNT,
  };
}

function escalatedValue(values: number[], offset: number): number {
  const low = Math.min(values.length - 1, Math.floor(offset));
  const high = Math.min(values.length - 1, low + 1);
  const fraction = offset - Math.floor(offset);
  return values[low] * (1 - fraction) + values[high] * fraction;
}

function bestPlay(
  outlook: Outlook,
  hand: Card[],
  offset: number,
): { value: number; rest: Card[] } | null {
  const best = pickBestSet(outlook.game, hand, outlook.botId);
  if (!best) return null;
  const value = isEscalating(outlook.game)
    ? best.totalValue - best.baseValue + escalatedValue(outlook.values, offset)
    : best.totalValue;
  return { value, rest: hand.filter((card) => !best.cards.includes(card)) };
}

function turnValue(
  outlook: Outlook,
  hand: Card[],
  offset: number,
  turnsLeft: number,
): number {
  const play = bestPlay(outlook, hand, offset);
  const played = play
    ? play.value +
      (turnsLeft > 0
        ? nextTurnValue(
            outlook,
            play.rest,
            offset + outlook.ownTrade + outlook.rivalTrades,
            turnsLeft - 1,
          )
        : 0)
    : 0;
  if (hand.length >= FORCED_HAND || turnsLeft === 0) return played;
  return Math.max(
    played,
    nextTurnValue(outlook, hand, offset + outlook.rivalTrades, turnsLeft - 1),
  );
}

function nextTurnValue(
  outlook: Outlook,
  hand: Card[],
  offset: number,
  turnsLeft: number,
): number {
  const symbolOdds = (1 - outlook.wildOdds) / SYMBOLS.length;
  const drawn = [
    ...SYMBOLS.map((symbol) => ({ symbol, odds: symbolOdds })),
    { symbol: null, odds: outlook.wildOdds },
  ].reduce(
    (sum, { symbol, odds }) =>
      sum +
      odds *
        turnValue(
          outlook,
          [...hand, { territoryId: null, symbol }],
          offset,
          turnsLeft,
        ),
    0,
  );
  const kept = turnValue(outlook, hand, offset, turnsLeft);
  return outlook.discount * (DRAW_ODDS * drawn + (1 - DRAW_ODDS) * kept);
}

export function forcedSetTroops(
  game: Game,
  playerId: number,
  index: number,
): number {
  if (!isEscalating(game)) return CONSTANT_FORCED_SET;
  return upcomingSetValues(game, playerId, index + 1)[index] ?? 0;
}

export function cashForcedSets(
  game: Game,
  playerId: number,
  hand: { cards: number; setsCashed: number },
): number {
  let troops = 0;
  while (hand.cards >= FORCED_HAND) {
    troops += forcedSetTroops(game, playerId, hand.setsCashed);
    hand.setsCashed++;
    hand.cards -= CARDS_PER_SET;
  }
  return troops;
}

export function canHoldSet(game: Game, botId: number): boolean {
  const hand = handOf(game, botId);
  return (
    game.cards !== 'off' &&
    hand.length < FORCED_HAND &&
    pickBestSet(game, hand, botId) !== null
  );
}

export function currentSetValue(game: Game, botId: number): number {
  return bestPlay(outlookFor(game, botId), handOf(game, botId), 0)?.value ?? 0;
}

export function holdingGain(game: Game, botId: number): number {
  const outlook = outlookFor(game, botId);
  const hand = handOf(game, botId);
  const play = bestPlay(outlook, hand, 0);
  if (!play) return 0;
  const held = nextTurnValue(
    outlook,
    hand,
    outlook.rivalTrades,
    LOOKAHEAD_TURNS - 1,
  );
  const afterPlay = nextTurnValue(
    outlook,
    play.rest,
    outlook.ownTrade + outlook.rivalTrades,
    LOOKAHEAD_TURNS - 1,
  );
  return held - afterPlay;
}
