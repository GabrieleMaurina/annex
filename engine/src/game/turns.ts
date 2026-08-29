import { callbacks } from '../callbacks';
import { getGameMap } from '../maps/maps';
import { broadcastGameState, sendPlayerCards } from '../session/store';
import { Game, TurnPhase } from '../types';
import {
  hasAnyAttack,
  hasAnyEntrench,
  hasAnyFortify,
  hasAnyToxin,
} from './combat/autoSkip';
import { checkGameEnd } from './end';
import {
  calculateDeployTroopsBreakdown,
  ownsAnyTerritory,
  turnOrderBonus,
} from './mechanics';
import {
  counterKey,
  pickBestSet,
  popRandomCard,
  returnCardsToDeck,
} from './progression/cards';
import { bumpStat } from './progression/stats';
import { updateRadiationForNewTurn } from './radiation/radiation';
import { recordReplayFrame } from './replay';
import { decrementToxinsGlobally } from './toxins/toxins';
import { fortifyFullPath } from './world/connectivity';
import { fogFilterEmit, recordLogForAll } from './world/fog';
import { portalCount, selectPortalTerritories } from './world/portals';
import { applyStarvation } from './world/starvation';
import {
  pathRunsForViewer,
  troopMoveFields,
  visibleTerritoryIdsOrAll,
} from './world/visibility';

const PHASE_ORDER: TurnPhase[] = [
  'deploy',
  'attack',
  'fortify',
  'entrench',
  'toxins',
];

export const PLACEMENT_PHASE_DURATION = 10;
export const CAPITAL_PHASE_DURATION = 60;
const TROOP_PHASE_TURN_MAX = 3;
const TROOP_PHASE_PER_TERRITORY_POOL = 2;

const turnTimers = new Map<string, NodeJS.Timeout>();

export function clearTurnTimer(gameName: string) {
  const timer = turnTimers.get(gameName);
  if (timer) clearTimeout(timer);
  turnTimers.delete(gameName);
}

function turnDurationSeconds(game: Game): number {
  if (game.turnPhase === 'territory' || game.turnPhase === 'troop')
    return PLACEMENT_PHASE_DURATION;
  if (game.turnPhase === 'capital') return CAPITAL_PHASE_DURATION;
  return game.turnDuration;
}

function scheduleTurnTimer(game: Game) {
  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now();
  if (game.paused) {
    game.pausedAt = Date.now();
    return;
  }
  const timer = setTimeout(
    () => forceEndTurn(game),
    turnDurationSeconds(game) * 1000,
  );
  turnTimers.set(game.name, timer);
}

export function pauseTurnTimer(game: Game) {
  if (game.paused) return;
  game.paused = true;
  game.pausedAt = Date.now();
  clearTurnTimer(game.name);
}

export function resumeTurnTimer(game: Game) {
  if (!game.paused) return;
  const pausedDuration = Date.now() - (game.pausedAt ?? Date.now());
  game.turnStartedAt += pausedDuration;
  game.paused = false;
  game.pausedAt = null;

  clearTurnTimer(game.name);
  const remaining =
    turnDurationSeconds(game) * 1000 - (Date.now() - game.turnStartedAt);
  const timer = setTimeout(() => forceEndTurn(game), Math.max(0, remaining));
  turnTimers.set(game.name, timer);
}

export function rewindTurnTimerIfBelowHalf(game: Game) {
  const half = (game.turnDuration * 1000) / 2;
  const elapsed = Date.now() - game.turnStartedAt;
  if (elapsed <= half) return;

  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now() - half;
  const timer = setTimeout(
    () => forceEndTurn(game),
    game.turnDuration * 1000 - half,
  );
  turnTimers.set(game.name, timer);
}

function dropTroopsRandomly(
  game: Game,
  playerId: number,
  amount: number,
  deposits: Map<number, number>,
  countsAsGained: boolean,
) {
  const territoryIds = [...game.territoryOwners.entries()]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([territoryId]) => territoryId);
  if (territoryIds.length === 0) return;

  if (countsAsGained) bumpStat(game, playerId, 'troopsGained', amount);
  const tally = new Map<number, number>();
  while (amount > 0) {
    const territoryId =
      territoryIds[Math.floor(Math.random() * territoryIds.length)];
    tally.set(territoryId, (tally.get(territoryId) ?? 0) + 1);
    amount--;
  }
  for (const [territoryId, troops] of tally) {
    game.territoryTroops.set(
      territoryId,
      (game.territoryTroops.get(territoryId) ?? 0) + troops,
    );
    deposits.set(territoryId, (deposits.get(territoryId) ?? 0) + troops);
    recordReplayFrame(game, { type: 'deploy', territoryId, troops, playerId });
  }
}

function forceCompleteDeployPhase(game: Game): Map<number, number> {
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
    bumpStat(game, playerId, 'setsPlayed');
    if (game.cards === 'Exponential' || game.cards === 'Exponential Per Player')
      game.cardsLastSetValue.set(key, best.baseValue);

    for (const territoryId of best.territoryBonusIds) {
      game.territoryTroops.set(
        territoryId,
        (game.territoryTroops.get(territoryId) ?? 0) + 2,
      );
      deposits.set(territoryId, (deposits.get(territoryId) ?? 0) + 2);
      recordReplayFrame(game, {
        type: 'deploy',
        territoryId,
        troops: 2,
        playerId,
      });
    }
    bumpStat(game, playerId, 'troopsGained', best.territoryBonusIds.length * 2);
    dropTroopsRandomly(game, playerId, best.baseValue, deposits, true);
  }

  if (cardsChanged) sendPlayerCards(game, playerId);

  return deposits;
}

function pickRandomOwnedTerritory(game: Game, playerId: number): number | null {
  const territoryIds = [...game.territoryOwners.entries()]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([territoryId]) => territoryId);
  if (territoryIds.length === 0) return null;
  return territoryIds[Math.floor(Math.random() * territoryIds.length)];
}

export function assignCapital(game: Game, territoryId: number) {
  game.capitalTerritoryIds.add(territoryId);
  game.territoryTroops.set(
    territoryId,
    (game.territoryTroops.get(territoryId) ?? 0) + 3,
  );
  const ownerId = game.territoryOwners.get(territoryId);
  if (ownerId !== undefined) bumpStat(game, ownerId, 'troopsGained', 3);
}

export function advanceCapitalPlacement(game: Game) {
  let index = game.turnPlayerIndex + 1;
  while (
    index < game.playerIds.length &&
    game.deathOrder.includes(game.playerIds[index])
  )
    index++;

  if (index >= game.playerIds.length) {
    beginNextSpecialPhase(game);
  } else {
    game.turnPlayerIndex = index;
    scheduleTurnTimer(game);
  }
}

export function startCapitalPlacement(game: Game) {
  game.turnNumber = 0;
  game.turnPlayerIndex = firstAliveIndex(game);
  game.turnPhase = 'capital';
  game.troopsToDeploy = 0;
  game.capitalTerritoryIds = new Set();
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onCapitalPlacementStarted(viewerId);
  }
  recordLogForAll(game, 'game:capitalPlacementStarted', {});
  scheduleTurnTimer(game);
}

function totalTerritoryCount(game: Game): number {
  return getGameMap(game).territories.length - game.radiationTerritoryIds.size;
}

function countTerritoriesByOwner(game: Game): Map<number, number> {
  const counts = new Map<number, number>();
  for (const ownerId of game.territoryOwners.values()) {
    counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
  }
  return counts;
}

function nextIndexMatching(
  game: Game,
  fromIndex: number,
  predicate: (playerId: number) => boolean,
): number | null {
  const n = game.playerIds.length;
  let index = fromIndex;
  for (let i = 0; i < n; i++) {
    index = (index + 1) % n;
    if (predicate(game.playerIds[index])) return index;
  }
  return null;
}

function firstAliveIndex(game: Game): number {
  return (
    nextIndexMatching(game, -1, (id) => !game.deathOrder.includes(id)) ?? 0
  );
}

function nextAliveIndexFrom(game: Game, fromIndex: number): number {
  return (
    nextIndexMatching(game, fromIndex, (id) => !game.deathOrder.includes(id)) ??
    fromIndex
  );
}

export function startTerritoryPhase(game: Game) {
  game.turnPlayerIndex = firstAliveIndex(game);
  game.turnPhase = 'territory';
  scheduleTurnTimer(game);
}

export function advanceTerritoryPhase(game: Game) {
  if (game.territoryOwners.size >= totalTerritoryCount(game)) {
    for (const id of game.playerIds) {
      if (!ownsAnyTerritory(game, id) && !game.deathOrder.includes(id))
        game.deathOrder.push(id);
    }
    beginNextSpecialPhase(game);
    return;
  }
  game.turnPlayerIndex = nextAliveIndexFrom(game, game.turnPlayerIndex);
  scheduleTurnTimer(game);
}

function nextTroopIndexFrom(game: Game, fromIndex: number): number | null {
  return nextIndexMatching(
    game,
    fromIndex,
    (id) =>
      !game.deathOrder.includes(id) &&
      (game.placementTroopPools.get(id) ?? 0) > 0,
  );
}

export function startTroopPhase(game: Game) {
  game.placementTroopPools = new Map();
  const territoryCounts = countTerritoriesByOwner(game);
  game.playerIds.forEach((id, i) => {
    if (game.deathOrder.includes(id)) return;
    const count = territoryCounts.get(id) ?? 0;
    game.placementTroopPools.set(
      id,
      count * TROOP_PHASE_PER_TERRITORY_POOL + turnOrderBonus(i),
    );
  });
  game.turnPhase = 'troop';
  let startIndex = 0;
  for (let i = 0; i < game.playerIds.length; i++) {
    const id = game.playerIds[i];
    if (
      !game.deathOrder.includes(id) &&
      (game.placementTroopPools.get(id) ?? 0) > 0
    ) {
      startIndex = i;
      break;
    }
  }
  game.turnPlayerIndex = startIndex;
  game.troopsToDeploy = Math.min(
    TROOP_PHASE_TURN_MAX,
    game.placementTroopPools.get(game.playerIds[startIndex]) ?? 0,
  );
  scheduleTurnTimer(game);
}

export function advanceTroopPhase(game: Game) {
  const nextIndex = nextTroopIndexFrom(game, game.turnPlayerIndex);
  if (nextIndex === null) {
    game.placementTroopPools = new Map();
    game.troopsToDeploy = 0;
    beginNextSpecialPhase(game);
    return;
  }
  game.turnPlayerIndex = nextIndex;
  game.troopsToDeploy = Math.min(
    TROOP_PHASE_TURN_MAX,
    game.placementTroopPools.get(game.playerIds[nextIndex]) ?? 0,
  );
  scheduleTurnTimer(game);
}

export function claimTerritory(
  game: Game,
  playerId: number,
  territoryId: number,
) {
  game.territoryOwners.set(territoryId, playerId);
  game.territoryTroops.set(territoryId, 1);
  recordReplayFrame(game, { type: 'deploy', territoryId, troops: 1, playerId });
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onTerritoryClaimed(viewerId, { territoryId, playerId });
  }
  recordLogForAll(game, 'game:territoryClaimed', { territoryId, playerId });
}

function autoClaimRandomTerritory(game: Game, playerId: number) {
  const map = getGameMap(game);
  const unclaimed = map.territories
    .map((t) => t.id)
    .filter(
      (id) =>
        !game.territoryOwners.has(id) && !game.radiationTerritoryIds.has(id),
    );
  if (unclaimed.length > 0) {
    const territoryId = unclaimed[Math.floor(Math.random() * unclaimed.length)];
    claimTerritory(game, playerId, territoryId);
  }
  advanceTerritoryPhase(game);
}

function autoPlaceRemainingTroops(game: Game, playerId: number) {
  const amount = game.troopsToDeploy;
  if (amount > 0) {
    const deposits = new Map<number, number>();
    dropTroopsRandomly(game, playerId, amount, deposits, false);
    const pool = game.placementTroopPools.get(playerId) ?? 0;
    game.placementTroopPools.set(playerId, Math.max(0, pool - amount));
    game.troopsToDeploy = 0;
    if (deposits.size > 0) {
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
          return filtered.length > 0 ? { deposits: filtered, playerId } : null;
        },
      );
    }
  }
  advanceTroopPhase(game);
}

export function beginNextSpecialPhase(game: Game) {
  const next = game.remainingSpecialPhases.shift();
  if (next === 'territory') startTerritoryPhase(game);
  else if (next === 'troop') startTroopPhase(game);
  else if (next === 'capital') startCapitalPlacement(game);
  else {
    startTurns(game);
    checkGameEnd(game);
  }
}

function startDeployPhase(game: Game, playerId: number) {
  game.deployCardMandate = (game.playerCards.get(playerId)?.length ?? 0) >= 5;
  const breakdown = calculateDeployTroopsBreakdown(game, playerId);
  game.troopsToDeploy =
    breakdown.territories +
    breakdown.bonuses +
    breakdown.capitals +
    breakdown.turnTroops +
    breakdown.bounties;
  const turnStartedPayload = {
    playerId,
    turnNumber: game.turnNumber,
    troopsFromTerritories: breakdown.territories,
    troopsFromBonuses: breakdown.bonuses,
    troopsFromCapitals: breakdown.capitals,
    troopsFromTurnTroops: breakdown.turnTroops,
    troopsFromBounties: breakdown.bounties,
  };
  for (const viewerId of [...game.playerIds, ...game.spectatorIds]) {
    callbacks.onTurnStarted(viewerId, turnStartedPayload);
  }
  recordLogForAll(game, 'game:turnStarted', turnStartedPayload);
}

function completePendingAttackMove(
  game: Game,
  playerId: number,
): { territoryId: number; fromTerritoryId: number; troops: number } | null {
  if (game.attackConquestMinTroops === null) return null;

  const startId = game.attackStartTerritoryId!;
  const endId = game.attackEndTerritoryId!;
  const troops = game.attackConquestMinTroops;
  const startTroops = game.territoryTroops.get(startId) ?? 0;

  game.territoryTroops.set(startId, startTroops - troops);
  game.territoryTroops.set(endId, troops);
  recordReplayFrame(game, {
    type: 'fortify',
    fromTerritoryId: startId,
    toTerritoryId: endId,
    troops,
    playerId,
  });
  return { territoryId: endId, fromTerritoryId: startId, troops };
}

function completePendingFortify(
  game: Game,
  playerId: number,
): { territoryId: number; fromTerritoryId: number; troops: number } | null {
  if (
    game.fortifyStartTerritoryId === null ||
    game.fortifyEndTerritoryId === null
  )
    return null;

  const startId = game.fortifyStartTerritoryId;
  const endId = game.fortifyEndTerritoryId;
  const startTroops = game.territoryTroops.get(startId) ?? 0;

  game.territoryTroops.set(startId, startTroops - 1);
  game.territoryTroops.set(endId, (game.territoryTroops.get(endId) ?? 0) + 1);
  recordReplayFrame(game, {
    type: 'fortify',
    fromTerritoryId: startId,
    toTerritoryId: endId,
    troops: 1,
    playerId,
  });
  return { territoryId: endId, fromTerritoryId: startId, troops: 1 };
}

export function forceEndTurn(game: Game) {
  forceEndTurnImpl(game);
  broadcastGameState(game);
}

export function forceEndTurnImpl(game: Game, skipDeploy = false) {
  const playerId = game.playerIds[game.turnPlayerIndex];

  if (game.turnPhase === 'territory') {
    autoClaimRandomTerritory(game, playerId);
    return;
  }

  if (game.turnPhase === 'troop') {
    autoPlaceRemainingTroops(game, playerId);
    return;
  }

  if (game.turnPhase === 'capital') {
    const territoryId = pickRandomOwnedTerritory(game, playerId);
    if (territoryId !== null) {
      assignCapital(game, territoryId);
      recordReplayFrame(game, {
        type: 'deploy',
        territoryId,
        troops: 3,
        playerId,
      });
      fogFilterEmit(game, 'game:deployed', callbacks.onDeployed, (viewerId) => {
        const visible = visibleTerritoryIdsOrAll(game, viewerId);
        if (visible !== null && !visible.has(territoryId)) return null;
        return { territoryId, troops: 3, playerId };
      });
    }
    advanceCapitalPlacement(game);
    return;
  }

  if (game.turnPhase === 'deploy' && !skipDeploy) {
    const deposits = forceCompleteDeployPhase(game);
    if (deposits.size > 0) {
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
          return filtered.length > 0 ? { deposits: filtered, playerId } : null;
        },
      );
    }
  }
  if (game.turnPhase === 'attack') {
    const move = completePendingAttackMove(game, playerId);
    if (move)
      fogFilterEmit(
        game,
        'game:attackMoved',
        callbacks.onAttackMoved,
        (viewerId) => {
          const visible = visibleTerritoryIdsOrAll(game, viewerId);
          if (
            visible !== null &&
            !visible.has(move.territoryId) &&
            !visible.has(move.fromTerritoryId)
          )
            return null;
          return {
            territoryId: move.territoryId,
            fromTerritoryId: move.fromTerritoryId,
            ...troopMoveFields(
              visible,
              move.fromTerritoryId,
              move.territoryId,
              move.troops,
            ),
          };
        },
      );
  }
  if (game.turnPhase === 'fortify') {
    const move = completePendingFortify(game, playerId);
    if (move) {
      const fullPath = fortifyFullPath(
        game,
        playerId,
        move.fromTerritoryId,
        move.territoryId,
      );
      fogFilterEmit(
        game,
        'game:fortified',
        callbacks.onFortified,
        (viewerId) => {
          const visible = visibleTerritoryIdsOrAll(game, viewerId);
          if (
            visible !== null &&
            !visible.has(move.territoryId) &&
            !visible.has(move.fromTerritoryId)
          )
            return null;
          return {
            territoryId: move.territoryId,
            fromTerritoryId: move.fromTerritoryId,
            playerId,
            path: pathRunsForViewer(fullPath, visible),
            ...troopMoveFields(
              visible,
              move.fromTerritoryId,
              move.territoryId,
              move.troops,
            ),
          };
        },
      );
    }
  }
  advanceToNextPlayer(game);
}

function findNextAliveIndexFrom(game: Game, fromIndex: number): number | null {
  return nextIndexMatching(
    game,
    fromIndex,
    (id) => ownsAnyTerritory(game, id) && !game.surrenderedIds.has(id),
  );
}

function nextAlivePlayerIndex(game: Game): number {
  const fromIndex = game.turnPlayerIndex;
  const nextIndex = findNextAliveIndexFrom(game, fromIndex);
  if (nextIndex === null) return fromIndex;
  if (nextIndex <= fromIndex) game.turnNumber++;
  return nextIndex;
}

function decrementEntrenchmentForPlayer(game: Game, playerId: number) {
  for (const [territoryId, turnsRemaining] of [...game.territoryEntrenchment]) {
    if (game.territoryOwners.get(territoryId) !== playerId) continue;
    if (turnsRemaining <= 1) game.territoryEntrenchment.delete(territoryId);
    else game.territoryEntrenchment.set(territoryId, turnsRemaining - 1);
  }
}

export function advanceToNextPlayer(game: Game) {
  const endingPlayerId = game.playerIds[game.turnPlayerIndex];
  bumpStat(game, endingPlayerId, 'turnsPlayed');

  if (game.conqueredThisTurn) {
    const card = popRandomCard(game.deck);
    if (card) {
      game.playerCards.get(endingPlayerId)?.push(card);
      bumpStat(game, endingPlayerId, 'cardsGained');
      sendPlayerCards(game, endingPlayerId);
    }
  }
  game.conqueredThisTurn = false;

  const starvationLosses = applyStarvation(game, endingPlayerId);
  if (starvationLosses.size > 0) {
    const entries = [...starvationLosses.entries()].map(
      ([territoryId, troops]) => ({
        territoryId,
        troops,
      }),
    );
    fogFilterEmit(game, 'game:starved', callbacks.onStarved, (viewerId) => {
      const visible = visibleTerritoryIdsOrAll(game, viewerId);
      const filtered =
        visible === null
          ? entries
          : entries.filter((e) => visible.has(e.territoryId));
      return filtered.length > 0 ? { losses: filtered } : null;
    });
  }

  const previousTurnNumber = game.turnNumber;
  let nextIndex = nextAlivePlayerIndex(game);

  if (game.turnNumber !== previousTurnNumber) {
    const eliminatedByRadiation = updateRadiationForNewTurn(game);
    if (eliminatedByRadiation.includes(game.playerIds[nextIndex])) {
      const reResolved = findNextAliveIndexFrom(game, game.turnPlayerIndex);
      if (reResolved !== null) nextIndex = reResolved;
    }
  }

  checkGameEnd(game, true);
  if (game.state === 'ended') return;

  if (game.turnNumber !== previousTurnNumber) updatePortalsForNewTurn(game);

  game.turnPlayerIndex = nextIndex;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  if (game.turnNumber !== previousTurnNumber) {
    const expiredToxinIds = decrementToxinsGlobally(game);
    if (expiredToxinIds.length > 0) {
      fogFilterEmit(
        game,
        'game:toxinExpired',
        callbacks.onToxinExpired,
        (viewerId) => {
          const visible = visibleTerritoryIdsOrAll(game, viewerId);
          const territoryIds =
            visible === null
              ? expiredToxinIds
              : expiredToxinIds.filter((id) => visible.has(id));
          return territoryIds.length > 0 ? { territoryIds } : null;
        },
      );
    }
  }
  decrementEntrenchmentForPlayer(game, game.playerIds[nextIndex]);
  startDeployPhase(game, game.playerIds[nextIndex]);
  scheduleTurnTimer(game);
}

export function advanceTurnPhase(game: Game) {
  const index = PHASE_ORDER.indexOf(game.turnPhase);
  if (index < PHASE_ORDER.length - 1) {
    game.turnPhase = PHASE_ORDER[index + 1];
    game.selectedTerritoryId = null;
    game.fortifyStartTerritoryId = null;
    game.fortifyEndTerritoryId = null;
    game.attackStartTerritoryId = null;
    game.attackEndTerritoryId = null;
    game.attackConquestMinTroops = null;

    const playerId = game.playerIds[game.turnPlayerIndex];
    if (game.turnPhase === 'attack' && !hasAnyAttack(game, playerId)) {
      advanceTurnPhase(game);
    } else if (game.turnPhase === 'fortify' && !hasAnyFortify(game, playerId)) {
      advanceTurnPhase(game);
    } else if (
      game.turnPhase === 'entrench' &&
      (game.entrenchments !== 'on' || !hasAnyEntrench(game, playerId))
    ) {
      advanceTurnPhase(game);
    } else if (
      game.turnPhase === 'toxins' &&
      (game.toxins === 'off' || !hasAnyToxin(game, playerId))
    ) {
      advanceTurnPhase(game);
    }
  } else {
    advanceToNextPlayer(game);
  }
}

function updatePortalsForNewTurn(game: Game) {
  if (game.portals !== 'dynamic') return;
  if (game.turnNumber % 2 === 1) {
    game.portalsEnabled = true;
    return;
  }
  const map = getGameMap(game);
  const exclude = new Set([
    ...game.portalTerritoryIds,
    ...game.radiationTerritoryIds,
    ...game.territoryToxins.keys(),
  ]);
  game.portalTerritoryIds = selectPortalTerritories(
    map,
    portalCount(map),
    exclude,
  );
  game.portalsEnabled = false;
}

export function startTurns(game: Game) {
  game.turnNumber = 0;
  game.turnPlayerIndex = 0;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  game.conqueredThisTurn = false;
  startDeployPhase(game, game.playerIds[0]);
  scheduleTurnTimer(game);
}
