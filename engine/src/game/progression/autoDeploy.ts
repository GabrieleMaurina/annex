import { callbacks } from '../../callbacks';
import { sendPlayerCards } from '../../session/store';
import { Game } from '../../types';
import {
  addTroopsCapped,
  deployTargetIds,
  MAX_TERRITORY_TROOPS,
} from '../mechanics';
import { recordReplayFrame } from '../replay';
import { fogFilterEmit } from '../world/fog';
import { visibleTerritoryIdsOrAll } from '../world/visibility';
import { counterKey, pickBestSet, returnCardsToDeck } from './cards';
import { bumpStat, recordCardSet } from './stats';

export function dropTroopsRandomly(
  game: Game,
  playerId: number,
  amount: number,
  deposits: Map<number, number>,
  countsAsGained: boolean,
) {
  const room = new Map<number, number>();
  for (const id of deployTargetIds(game, playerId)) {
    const free = MAX_TERRITORY_TROOPS - (game.territoryTroops.get(id) ?? 0);
    if (free > 0) room.set(id, free);
  }
  const open = [...room.keys()];
  const tally = new Map<number, number>();
  let placed = 0;
  while (placed < amount && open.length > 0) {
    const index = Math.floor(Math.random() * open.length);
    const territoryId = open[index];
    tally.set(territoryId, (tally.get(territoryId) ?? 0) + 1);
    placed++;
    const left = room.get(territoryId)! - 1;
    room.set(territoryId, left);
    if (left === 0) {
      open[index] = open[open.length - 1];
      open.pop();
    }
  }

  if (countsAsGained) bumpStat(game, playerId, 'troopsGained', placed);
  for (const [territoryId, troops] of tally) {
    game.territoryTroops.set(
      territoryId,
      (game.territoryTroops.get(territoryId) ?? 0) + troops,
    );
    deposits.set(territoryId, (deposits.get(territoryId) ?? 0) + troops);
    recordReplayFrame(game, { type: 'deploy', territoryId, troops, playerId });
  }
  return placed;
}

export function emitDeployedMany(
  game: Game,
  playerId: number,
  deposits: Map<number, number>,
  surge = false,
) {
  if (deposits.size === 0) return;
  const entries = [...deposits.entries()].map(([territoryId, troops]) => ({
    territoryId,
    troops,
  }));
  fogFilterEmit(
    game,
    'game:deployedMany',
    callbacks.onDeployedMany,
    (viewerId) => {
      const visible = visibleTerritoryIdsOrAll(game, viewerId);
      const filtered =
        visible === null
          ? entries
          : entries.filter((e) => visible.has(e.territoryId));
      return filtered.length > 0
        ? { deposits: filtered, playerId, ...(surge ? { surge } : {}) }
        : null;
    },
  );
}

export function forceCompleteDeployPhase(game: Game): Map<number, number> {
  const playerId = game.playerIds[game.turnPlayerIndex];
  const deposits = new Map<number, number>();
  let cardsChanged = false;

  dropTroopsRandomly(game, playerId, game.troopsToDeploy, deposits, true);
  game.troopsToDeploy = 0;

  while ((game.playerCards.get(playerId)?.length ?? 0) >= 5) {
    const hand = game.playerCards.get(playerId) ?? [];
    const best = pickBestSet(game, hand, playerId);
    if (!best) break;

    for (const used of best.cards) {
      const index = hand.indexOf(used);
      if (index !== -1) hand.splice(index, 1);
    }
    cardsChanged = true;
    returnCardsToDeck(game.deck, best.cards);
    const key = counterKey(game, playerId);
    game.cardSetsPlayed.set(key, (game.cardSetsPlayed.get(key) ?? 0) + 1);
    if (game.cards === 'exponential' || game.cards === 'exponential per player')
      game.cardsLastSetValue.set(key, best.baseValue);

    let bonusGained = 0;
    for (const territoryId of best.territoryBonusIds) {
      const troops = addTroopsCapped(game, territoryId, 2);
      bonusGained += troops;
      deposits.set(territoryId, (deposits.get(territoryId) ?? 0) + troops);
      recordReplayFrame(game, {
        type: 'deploy',
        territoryId,
        troops,
        playerId,
      });
    }
    bumpStat(game, playerId, 'troopsGained', bonusGained);
    const placed = dropTroopsRandomly(
      game,
      playerId,
      best.baseValue,
      deposits,
      true,
    );
    recordCardSet(game, playerId, bonusGained + placed);
  }

  if (cardsChanged) sendPlayerCards(game, playerId);

  return deposits;
}
