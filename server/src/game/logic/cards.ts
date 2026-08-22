import { Card, CardSymbol, Game } from '../../types';

const SYMBOLS: CardSymbol[] = ['soldier', 'humvee', 'tank'];

export type SetKind = CardSymbol | 'mixed';

const CONSTANT_VALUES: Record<SetKind, number> = {
  soldier: 4,
  humvee: 6,
  tank: 8,
  mixed: 10,
};

const LINEAR_TABLE = [4, 6, 8, 10, 12, 15, 20, 25, 30];

function linearValue(setNumber: number): number {
  if (setNumber <= LINEAR_TABLE.length) return LINEAR_TABLE[setNumber - 1];
  return 30 + (setNumber - LINEAR_TABLE.length) * 5;
}

const GLOBAL_COUNTER_KEY = 0;

function isPerPlayer(mode: Game['cards']): boolean {
  return mode === 'Linear Per Player' || mode === 'Exponential Per Player';
}

export function counterKey(game: Game, playerId: number): number {
  return isPerPlayer(game.cards) ? playerId : GLOBAL_COUNTER_KEY;
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

export function nextSetBaseValues(
  game: Game,
  playerId: number,
): Record<SetKind, number> {
  if (game.cards === 'Constant') return { ...CONSTANT_VALUES };
  const key = counterKey(game, playerId);
  const value =
    game.cards === 'Linear' || game.cards === 'Linear Per Player'
      ? linearValue((game.cardSetsPlayed.get(key) ?? 0) + 1)
      : (game.cardsLastSetValue.get(key) ?? 0) === 0
        ? 5
        : Math.ceil((game.cardsLastSetValue.get(key) ?? 0) * 1.3);
  return { soldier: value, humvee: value, tank: value, mixed: value };
}

export function upcomingSetValues(
  game: Game,
  playerId: number,
  count: number,
): number[] {
  if (game.cards === 'Constant') return [];
  const key = counterKey(game, playerId);
  if (game.cards === 'Linear' || game.cards === 'Linear Per Player') {
    return Array.from({ length: count }, (_, i) =>
      linearValue((game.cardSetsPlayed.get(key) ?? 0) + 1 + i),
    );
  }
  const values: number[] = [];
  let last = game.cardsLastSetValue.get(key) ?? 0;
  for (let i = 0; i < count; i++) {
    last = last === 0 ? 5 : Math.ceil(last * 1.3);
    values.push(last);
  }
  return values;
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

  const values = nextSetBaseValues(game, playerId);
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
