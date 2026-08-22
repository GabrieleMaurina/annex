import type { Card, CardSymbol, SetKind } from '../lib/types';

function setKindCandidates(realSymbols: CardSymbol[]): SetKind[] {
  const candidates: SetKind[] = [];
  if (realSymbols.length > 0 && realSymbols.every((s) => s === realSymbols[0]))
    candidates.push(realSymbols[0]);
  if (new Set(realSymbols).size === realSymbols.length)
    candidates.push('mixed');
  return candidates;
}

export interface EvaluatedCombo {
  cards: Card[];
  setKind: SetKind;
  baseValue: number;
  territoryBonusIds: number[];
  totalValue: number;
}

export function evaluateCombo(
  values: Record<SetKind, number>,
  ownedTerritoryIds: Set<number>,
  combo: Card[],
): EvaluatedCombo | null {
  const realSymbols = combo
    .map((c) => c.symbol)
    .filter((s): s is CardSymbol => s !== null);
  const candidates = setKindCandidates(realSymbols);
  if (candidates.length === 0) return null;

  let setKind = candidates[0];
  let baseValue = values[setKind];
  for (const candidate of candidates) {
    if (values[candidate] > baseValue) {
      setKind = candidate;
      baseValue = values[candidate];
    }
  }

  const territoryBonusIds = combo
    .filter(
      (c) => c.territoryId !== null && ownedTerritoryIds.has(c.territoryId),
    )
    .map((c) => c.territoryId as number);

  return {
    cards: combo,
    setKind,
    baseValue,
    territoryBonusIds,
    totalValue: baseValue + territoryBonusIds.length * 2,
  };
}

export function enumerateCombos(
  hand: Card[],
  values: Record<SetKind, number>,
  ownedTerritoryIds: Set<number>,
): EvaluatedCombo[] {
  const results: EvaluatedCombo[] = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const evaluated = evaluateCombo(values, ownedTerritoryIds, [
          hand[i],
          hand[j],
          hand[k],
        ]);
        if (evaluated) results.push(evaluated);
      }
    }
  }
  results.sort((a, b) => {
    if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
    const wildsA = a.cards.filter((c) => c.symbol === null).length;
    const wildsB = b.cards.filter((c) => c.symbol === null).length;
    return wildsA - wildsB;
  });
  return results;
}

export function comboKey(combo: EvaluatedCombo): string {
  return combo.cards.map((c) => c.territoryId).join('-');
}

export function sortForDisplay(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) => (a.territoryId ?? Infinity) - (b.territoryId ?? Infinity),
  );
}

function cardKey(card: Card): string {
  return card.territoryId !== null ? `t${card.territoryId}` : 'wild';
}

export function diffNewCards(prev: Card[], next: Card[]): Card[] {
  const prevCounts = new Map<string, number>();
  for (const card of prev) {
    const key = cardKey(card);
    prevCounts.set(key, (prevCounts.get(key) ?? 0) + 1);
  }

  const added: Card[] = [];
  const seenCounts = new Map<string, number>();
  for (const card of next) {
    const key = cardKey(card);
    const seen = (seenCounts.get(key) ?? 0) + 1;
    seenCounts.set(key, seen);
    if (seen > (prevCounts.get(key) ?? 0)) added.push(card);
  }
  return added;
}
