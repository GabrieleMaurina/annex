import { Card, CardSymbol, Game } from '../../types';

const SYMBOLS: CardSymbol[] = ['soldier', 'humvee', 'tank'];

export type SetKind = CardSymbol | 'mixed';

const FIXED_VALUES: Record<SetKind, number> = {
  soldier: 4,
  humvee: 6,
  tank: 8,
  mixed: 10,
};

const PROGRESSIVE_TABLE = [4, 6, 8, 10, 12, 15, 20, 25, 30];

function progressiveValue(setNumber: number): number {
  if (setNumber <= PROGRESSIVE_TABLE.length)
    return PROGRESSIVE_TABLE[setNumber - 1];
  return 30 + (setNumber - PROGRESSIVE_TABLE.length) * 5;
}

export function buildCardDeck(territoryIds: number[]): Card[] {
  const base = Math.floor(territoryIds.length / 3);
  const remainder = territoryIds.length - base * 3;
  const symbols: CardSymbol[] = [];
  for (const symbol of SYMBOLS) {
    for (let i = 0; i < base; i++) symbols.push(symbol);
  }
  for (let i = 0; i < remainder; i++) {
    symbols.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  }
  for (let i = symbols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  }

  const deck: Card[] = territoryIds.map((territoryId, i) => ({
    territoryId,
    symbol: symbols[i],
  }));
  deck.push(
    { territoryId: null, symbol: null },
    { territoryId: null, symbol: null },
  );
  return deck;
}

export function popRandomCard(deck: Card[]): Card | undefined {
  if (deck.length === 0) return undefined;
  const index = Math.floor(Math.random() * deck.length);
  return deck.splice(index, 1)[0];
}

export function returnCardsToDeck(deck: Card[], cards: Card[]): void {
  deck.push(...cards);
}

export function nextSetBaseValues(game: Game): Record<SetKind, number> {
  if (game.cards === 'Fixed') return { ...FIXED_VALUES };
  const value =
    game.cards === 'Progressive'
      ? progressiveValue(game.cardSetsPlayed + 1)
      : game.cardsLastSetValue === 0
        ? 5
        : Math.ceil(game.cardsLastSetValue * 1.3);
  return { soldier: value, humvee: value, tank: value, mixed: value };
}

function setKindCandidates(realSymbols: CardSymbol[]): SetKind[] {
  const candidates: SetKind[] = [];
  if (realSymbols.length > 0 && realSymbols.every((s) => s === realSymbols[0]))
    candidates.push(realSymbols[0]);
  if (new Set(realSymbols).size === realSymbols.length)
    candidates.push('mixed');
  return candidates;
}

export interface EvaluatedSet {
  cards: Card[];
  setKind: SetKind;
  baseValue: number;
  territoryBonusIds: number[];
  totalValue: number;
}

function evaluateCombo(
  game: Game,
  playerId: number,
  cardsUsed: Card[],
): EvaluatedSet | null {
  const realSymbols = cardsUsed
    .map((c) => c.symbol)
    .filter((s): s is CardSymbol => s !== null);
  const candidates = setKindCandidates(realSymbols);
  if (candidates.length === 0) return null;

  const values = nextSetBaseValues(game);
  let setKind = candidates[0];
  let baseValue = values[setKind];
  for (const candidate of candidates) {
    if (values[candidate] > baseValue) {
      setKind = candidate;
      baseValue = values[candidate];
    }
  }

  const territoryBonusIds = cardsUsed
    .filter(
      (c) =>
        c.territoryId !== null &&
        game.territoryOwners.get(c.territoryId) === playerId,
    )
    .map((c) => c.territoryId as number);

  return {
    cards: cardsUsed,
    setKind,
    baseValue,
    territoryBonusIds,
    totalValue: baseValue + territoryBonusIds.length * 2,
  };
}

export function evaluateCardSelection(
  game: Game,
  hand: Card[],
  playerId: number,
  selection: (number | null)[],
): EvaluatedSet | null {
  if (selection.length !== 3) return null;

  const remaining = [...hand];
  const cardsUsed: Card[] = [];
  for (const requested of selection) {
    const index = remaining.findIndex((c) => c.territoryId === requested);
    if (index === -1) return null;
    cardsUsed.push(remaining.splice(index, 1)[0]);
  }

  return evaluateCombo(game, playerId, cardsUsed);
}

// Mirrors the client's own set ranking (enumerateCombos in
// client/src/game/cards.ts): highest total value first, ties broken by
// fewest wild cards used — so a forced auto-play (see turns.ts) picks the
// same set a player would see proposed by default.
export function pickBestSet(
  game: Game,
  hand: Card[],
  playerId: number,
): EvaluatedSet | null {
  let best: EvaluatedSet | null = null;
  const n = hand.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const evaluated = evaluateCombo(game, playerId, [
          hand[i],
          hand[j],
          hand[k],
        ]);
        if (!evaluated) continue;
        if (!best || evaluated.totalValue > best.totalValue) {
          best = evaluated;
          continue;
        }
        if (evaluated.totalValue === best.totalValue) {
          const wildsEvaluated = evaluated.cards.filter(
            (c) => c.symbol === null,
          ).length;
          const wildsBest = best.cards.filter((c) => c.symbol === null).length;
          if (wildsEvaluated < wildsBest) best = evaluated;
        }
      }
    }
  }
  return best;
}

export function hasPlayableSet(hand: Card[]): boolean {
  const n = hand.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const realSymbols = [hand[i], hand[j], hand[k]]
          .map((c) => c.symbol)
          .filter((s): s is CardSymbol => s !== null);
        if (setKindCandidates(realSymbols).length > 0) return true;
      }
    }
  }
  return false;
}
