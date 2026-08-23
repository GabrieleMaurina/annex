import { Server } from 'socket.io';
import { maps } from '../../maps';
import { Game, Player, TurnPhase } from '../../types';
import { hasAnyAttack, hasAnyFortify } from './autoSkip';
import {
  counterKey,
  pickBestSet,
  popRandomCard,
  returnCardsToDeck,
} from './cards';
import { checkGameEnd } from './end';
import {
  calculateDeployTroopsBreakdown,
  ownsAnyTerritory,
  turnOrderBonus,
} from './mechanics';
import { recordReplayFrame } from './replay';
import { gameRoomName } from './rooms';
import { bumpStat } from './stats';
import { sendPlayerCards } from './store';

const PHASE_ORDER: TurnPhase[] = ['deploy', 'attack', 'fortify'];

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

function scheduleTurnTimer(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now();
  if (game.paused) {
    game.pausedAt = Date.now();
    return;
  }
  const timer = setTimeout(
    () => forceEndTurn(game, io, playersById),
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

export function resumeTurnTimer(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  if (!game.paused) return;
  const pausedDuration = Date.now() - (game.pausedAt ?? Date.now());
  game.turnStartedAt += pausedDuration;
  game.paused = false;
  game.pausedAt = null;

  clearTurnTimer(game.name);
  const remaining =
    turnDurationSeconds(game) * 1000 - (Date.now() - game.turnStartedAt);
  const timer = setTimeout(
    () => forceEndTurn(game, io, playersById),
    Math.max(0, remaining),
  );
  turnTimers.set(game.name, timer);
}

export function rewindTurnTimerIfBelowHalf(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  const half = (game.turnDuration * 1000) / 2;
  const elapsed = Date.now() - game.turnStartedAt;
  if (elapsed <= half) return;

  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now() - half;
  const timer = setTimeout(
    () => forceEndTurn(game, io, playersById),
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
    recordReplayFrame(game, {
      type: 'deploy',
      territoryId,
      troops,
      playerId,
    });
  }
}

function forceCompleteDeployPhase(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
): Map<number, number> {
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

  if (cardsChanged) sendPlayerCards(io, playersById, game, playerId);

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

export function advanceCapitalPlacement(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  let index = game.turnPlayerIndex + 1;
  while (
    index < game.playerIds.length &&
    game.deathOrder.includes(game.playerIds[index])
  )
    index++;

  if (index >= game.playerIds.length) {
    beginNextSpecialPhase(game, io, playersById);
  } else {
    game.turnPlayerIndex = index;
    scheduleTurnTimer(game, io, playersById);
  }
}

export function startCapitalPlacement(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  game.turnNumber = 0;
  game.turnPlayerIndex = firstAliveIndex(game);
  game.turnPhase = 'capital';
  game.troopsToDeploy = 0;
  game.capitalTerritoryIds = new Set();
  io.to(gameRoomName(game.name)).emit('game:capitalPlacementStarted');
  scheduleTurnTimer(game, io, playersById);
}

function totalTerritoryCount(game: Game): number {
  return maps.get(game.mapName)!.territories.length;
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

export function startTerritoryPhase(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  game.turnPlayerIndex = firstAliveIndex(game);
  game.turnPhase = 'territory';
  scheduleTurnTimer(game, io, playersById);
}

export function advanceTerritoryPhase(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  if (game.territoryOwners.size >= totalTerritoryCount(game)) {
    for (const id of game.playerIds) {
      if (!ownsAnyTerritory(game, id) && !game.deathOrder.includes(id))
        game.deathOrder.push(id);
    }
    beginNextSpecialPhase(game, io, playersById);
    return;
  }
  game.turnPlayerIndex = nextAliveIndexFrom(game, game.turnPlayerIndex);
  scheduleTurnTimer(game, io, playersById);
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

export function startTroopPhase(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
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
  scheduleTurnTimer(game, io, playersById);
}

export function advanceTroopPhase(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  const nextIndex = nextTroopIndexFrom(game, game.turnPlayerIndex);
  if (nextIndex === null) {
    game.placementTroopPools = new Map();
    game.troopsToDeploy = 0;
    beginNextSpecialPhase(game, io, playersById);
    return;
  }
  game.turnPlayerIndex = nextIndex;
  game.troopsToDeploy = Math.min(
    TROOP_PHASE_TURN_MAX,
    game.placementTroopPools.get(game.playerIds[nextIndex]) ?? 0,
  );
  scheduleTurnTimer(game, io, playersById);
}

export function claimTerritory(
  game: Game,
  io: Server,
  playerId: number,
  territoryId: number,
) {
  game.territoryOwners.set(territoryId, playerId);
  game.territoryTroops.set(territoryId, 1);
  recordReplayFrame(game, {
    type: 'deploy',
    territoryId,
    troops: 1,
    playerId,
  });
  io.to(gameRoomName(game.name)).emit('game:territoryClaimed', {
    territoryId,
    playerId,
  });
}

function autoClaimRandomTerritory(
  game: Game,
  io: Server,
  playerId: number,
  playersById: Map<number, Player>,
) {
  const map = maps.get(game.mapName)!;
  const unclaimed = map.territories
    .map((t) => t.id)
    .filter((id) => !game.territoryOwners.has(id));
  if (unclaimed.length > 0) {
    const territoryId = unclaimed[Math.floor(Math.random() * unclaimed.length)];
    claimTerritory(game, io, playerId, territoryId);
  }
  advanceTerritoryPhase(game, io, playersById);
}

function autoPlaceRemainingTroops(
  game: Game,
  io: Server,
  playerId: number,
  playersById: Map<number, Player>,
) {
  const amount = game.troopsToDeploy;
  if (amount > 0) {
    const deposits = new Map<number, number>();
    dropTroopsRandomly(game, playerId, amount, deposits, false);
    const pool = game.placementTroopPools.get(playerId) ?? 0;
    game.placementTroopPools.set(playerId, Math.max(0, pool - amount));
    game.troopsToDeploy = 0;
    if (deposits.size > 0) {
      io.to(gameRoomName(game.name)).emit('game:deployedMany', {
        deposits: [...deposits.entries()].map(([territoryId, troops]) => ({
          territoryId,
          troops,
        })),
      });
    }
  }
  advanceTroopPhase(game, io, playersById);
}

export function beginNextSpecialPhase(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  const next = game.remainingSpecialPhases.shift();
  if (next === 'territory') startTerritoryPhase(game, io, playersById);
  else if (next === 'troop') startTroopPhase(game, io, playersById);
  else if (next === 'capital') startCapitalPlacement(game, io, playersById);
  else {
    startTurns(game, io, playersById);
    checkGameEnd(game);
  }
}

function startDeployPhase(game: Game, io: Server, playerId: number) {
  const breakdown = calculateDeployTroopsBreakdown(game, playerId);
  game.troopsToDeploy =
    breakdown.territories + breakdown.bonuses + breakdown.capitals;
  io.to(gameRoomName(game.name)).emit('game:turnStarted', {
    playerId,
    turnNumber: game.turnNumber,
    troopsFromTerritories: breakdown.territories,
    troopsFromBonuses: breakdown.bonuses,
    troopsFromCapitals: breakdown.capitals,
  });
}

function completePendingAttackMove(
  game: Game,
  playerId: number,
): { territoryId: number; troops: number } | null {
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
  return { territoryId: endId, troops };
}

function completePendingFortify(
  game: Game,
  playerId: number,
): { territoryId: number; troops: number } | null {
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
  return { territoryId: endId, troops: 1 };
}

export function forceEndTurn(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  const room = gameRoomName(game.name);
  const playerId = game.playerIds[game.turnPlayerIndex];

  if (game.turnPhase === 'territory') {
    autoClaimRandomTerritory(game, io, playerId, playersById);
    return;
  }

  if (game.turnPhase === 'troop') {
    autoPlaceRemainingTroops(game, io, playerId, playersById);
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
      io.to(room).emit('game:deployed', { territoryId, troops: 3 });
    }
    advanceCapitalPlacement(game, io, playersById);
    return;
  }

  if (game.turnPhase === 'deploy') {
    const deposits = forceCompleteDeployPhase(game, io, playersById);
    if (deposits.size > 0) {
      io.to(room).emit('game:deployedMany', {
        deposits: [...deposits.entries()].map(([territoryId, troops]) => ({
          territoryId,
          troops,
        })),
      });
    }
  }
  if (game.turnPhase === 'attack') {
    const move = completePendingAttackMove(game, playerId);
    if (move) io.to(room).emit('game:attackMoved', move);
  }
  if (game.turnPhase === 'fortify') {
    const move = completePendingFortify(game, playerId);
    if (move) io.to(room).emit('game:fortified', move);
  }
  advanceToNextPlayer(game, io, playersById);
}

function nextAlivePlayerIndex(game: Game): number {
  const fromIndex = game.turnPlayerIndex;
  const nextIndex = nextIndexMatching(
    game,
    fromIndex,
    (id) => ownsAnyTerritory(game, id) && !game.surrenderedIds.has(id),
  );
  if (nextIndex === null) return fromIndex;
  if (nextIndex <= fromIndex) game.turnNumber++;
  return nextIndex;
}

export function advanceToNextPlayer(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
  const endingPlayerId = game.playerIds[game.turnPlayerIndex];
  bumpStat(game, endingPlayerId, 'turnsPlayed');

  if (game.conqueredThisTurn) {
    const card = popRandomCard(game.deck);
    if (card) {
      game.playerCards.get(endingPlayerId)?.push(card);
      bumpStat(game, endingPlayerId, 'cardsGained');
      sendPlayerCards(io, playersById, game, endingPlayerId);
    }
  }
  game.conqueredThisTurn = false;

  const nextIndex = nextAlivePlayerIndex(game);

  checkGameEnd(game, true);
  if (game.state === 'ended') return;

  game.turnPlayerIndex = nextIndex;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  startDeployPhase(game, io, game.playerIds[nextIndex]);
  scheduleTurnTimer(game, io, playersById);
}

export function advanceTurnPhase(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
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
      advanceTurnPhase(game, io, playersById);
    } else if (game.turnPhase === 'fortify' && !hasAnyFortify(game, playerId)) {
      advanceTurnPhase(game, io, playersById);
    }
  } else {
    advanceToNextPlayer(game, io, playersById);
  }
}

export function startTurns(
  game: Game,
  io: Server,
  playersById: Map<number, Player>,
) {
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
  startDeployPhase(game, io, game.playerIds[0]);
  scheduleTurnTimer(game, io, playersById);
}
