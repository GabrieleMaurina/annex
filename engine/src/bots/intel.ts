import { Game } from '../types';
import { BotView, isVisible, ownerOf, troopsAt } from './view';

export interface PublicIncome {
  territories: number;
  bonuses: number;
}

interface TurnStartedLog {
  playerId: number;
  troopsFromTerritories: number;
  troopsFromBonuses: number;
}

interface HeldCandidate {
  ids: number[];
  bonus: number;
  known: number;
}

const MAX_CANDIDATES = 12;

export function publicIncomes(
  game: Game,
  botId: number,
): Map<number, PublicIncome> {
  const incomes = new Map<number, PublicIncome>();
  const log = game.logs.get(botId) ?? [];
  const rivals = game.playerIds.filter(
    (id) => id !== botId && !game.deathOrder.includes(id),
  ).length;
  for (let i = log.length - 1; i >= 0 && incomes.size < rivals; i--) {
    if (log[i].type !== 'game:turnStarted') continue;
    const entry = log[i].payload as TurnStartedLog;
    if (entry.playerId === botId || incomes.has(entry.playerId)) continue;
    incomes.set(entry.playerId, {
      territories: entry.troopsFromTerritories,
      bonuses: entry.troopsFromBonuses,
    });
  }
  return incomes;
}

function bestSubset(
  candidates: HeldCandidate[],
  target: number,
): HeldCandidate[] | null {
  let best: HeldCandidate[] | null = null;
  let bestKnown = -1;
  const picked: HeldCandidate[] = [];
  const search = (index: number, sum: number, known: number) => {
    if (sum === target) {
      if (known > bestKnown) {
        bestKnown = known;
        best = [...picked];
      }
      return;
    }
    if (sum > target || index === candidates.length) return;
    picked.push(candidates[index]);
    search(
      index + 1,
      sum + candidates[index].bonus,
      known + candidates[index].known,
    );
    picked.pop();
    search(index + 1, sum, known);
  };
  search(0, 0, 0);
  return best;
}

function heldCandidates(
  game: Game,
  view: BotView,
  playerId: number,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
): HeldCandidate[] {
  const candidates: HeldCandidate[] = [];
  for (const [continentId, ids] of continentTerritories) {
    const bonus = bonuses[continentId] ?? 0;
    if (bonus <= 0) continue;
    const owners = ids.map((id) => ownerOf(game, view, id));
    if (owners.some((o) => o !== undefined && o !== playerId)) continue;
    const known = owners.filter((o) => o === playerId).length;
    if (known > 0) candidates.push({ ids, bonus, known });
  }
  return candidates.sort((a, b) => b.known - a.known).slice(0, MAX_CANDIDATES);
}

function averageKnownTroops(
  game: Game,
  view: BotView,
  playerId: number,
): number {
  let total = 0;
  let count = 0;
  for (const territory of game.territoryOwners.keys()) {
    if (ownerOf(game, view, territory) !== playerId) continue;
    total += troopsAt(game, view, territory);
    count++;
  }
  return Math.max(1, Math.round(total / Math.max(1, count)));
}

export function withPublicIntel(
  game: Game,
  view: BotView,
  incomes: Map<number, PublicIncome>,
  continentTerritories: Map<number, number[]>,
  bonuses: number[],
): BotView {
  const remembered = new Map(view.remembered);
  for (const [playerId, income] of incomes) {
    if (income.bonuses <= 0) continue;
    const held = bestSubset(
      heldCandidates(game, view, playerId, continentTerritories, bonuses),
      income.bonuses,
    );
    if (!held) continue;
    const troops = averageKnownTroops(game, view, playerId);
    for (const { ids } of held)
      for (const id of ids)
        if (!isVisible(view, id) && !remembered.has(id))
          remembered.set(id, { ownerId: playerId, troops });
  }
  return { visibleIds: view.visibleIds, remembered };
}
