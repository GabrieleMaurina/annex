import { Server } from 'socket.io';
import { Game, TurnPhase } from '../../types';
import { hasAnyAttack, hasAnyFortify } from './autoSkip';
import { pickBestSet, popRandomCard, returnCardsToDeck } from './cards';
import { checkGameEnd } from './end';
import { calculateDeployTroopsBreakdown, ownsAnyTerritory } from './mechanics';
import { recordReplayFrame } from './replay';
import { gameRoomName } from './rooms';
import { bumpStat } from './stats';

const PHASE_ORDER: TurnPhase[] = ['deploy', 'attack', 'fortify'];

const turnTimers = new Map<string, NodeJS.Timeout>();

export function clearTurnTimer(gameName: string) {
  const timer = turnTimers.get(gameName);
  if (timer) clearTimeout(timer);
  turnTimers.delete(gameName);
}

function scheduleTurnTimer(game: Game, io: Server) {
  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now();
  if (game.paused) {
    game.pausedAt = Date.now();
    return;
  }
  const timer = setTimeout(
    () => forceEndTurn(game, io),
    game.turnDuration * 1000,
  );
  turnTimers.set(game.name, timer);
}

export function pauseTurnTimer(game: Game) {
  if (game.paused) return;
  game.paused = true;
  game.pausedAt = Date.now();
  clearTurnTimer(game.name);
}

export function resumeTurnTimer(game: Game, io: Server) {
  if (!game.paused) return;
  const pausedDuration = Date.now() - (game.pausedAt ?? Date.now());
  game.turnStartedAt += pausedDuration;
  game.paused = false;
  game.pausedAt = null;

  clearTurnTimer(game.name);
  const remaining =
    game.turnDuration * 1000 - (Date.now() - game.turnStartedAt);
  const timer = setTimeout(
    () => forceEndTurn(game, io),
    Math.max(0, remaining),
  );
  turnTimers.set(game.name, timer);
}

export function rewindTurnTimerIfBelowHalf(game: Game, io: Server) {
  const half = (game.turnDuration * 1000) / 2;
  const elapsed = Date.now() - game.turnStartedAt;
  if (elapsed <= half) return;

  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now() - half;
  const timer = setTimeout(
    () => forceEndTurn(game, io),
    game.turnDuration * 1000 - half,
  );
  turnTimers.set(game.name, timer);
}

// Drops `amount` troops one at a time on random territories the player
// owns, tallying how many landed on each — the tally is merged into
// `deposits` so the whole forced deploy phase (leftover troops, plus any
// troops from auto-played sets) ends up as a single batch of animations.
function dropRandomTroops(
  game: Game,
  playerId: number,
  amount: number,
  deposits: Map<number, number>,
) {
  const territoryIds = [...game.territoryOwners.entries()]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([territoryId]) => territoryId);
  if (territoryIds.length === 0) {
    game.troopsToDeploy = 0;
    return;
  }

  bumpStat(game, playerId, 'troopsGained', amount);
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

// Finishes an unattended deploy phase: drops whatever's left in the pool,
// then — same as a player who lets 5+ cards go untouched isn't normally
// allowed to — keeps auto-playing the single best available set (see
// pickBestSet in cards.ts) and dropping the troops it grants, until the
// hand is back under 5. Returns every territory that received troops this
// way, for one combined deploy animation/sound.
function forceCompleteDeployPhase(game: Game): Map<number, number> {
  const playerId = game.playerIds[game.turnPlayerIndex];
  const deposits = new Map<number, number>();

  dropRandomTroops(game, playerId, game.troopsToDeploy, deposits);
  game.troopsToDeploy = 0;

  while ((game.playerCards.get(playerId)?.length ?? 0) >= 5) {
    const hand = game.playerCards.get(playerId) ?? [];
    const best = pickBestSet(game, hand, playerId);
    if (!best) break;

    for (const used of best.cards) {
      const index = hand.indexOf(used);
      if (index !== -1) hand.splice(index, 1);
    }
    returnCardsToDeck(game.deck, best.cards);
    game.cardSetsPlayed++;
    bumpStat(game, playerId, 'setsPlayed');
    if (game.cards === 'Exponential') game.cardsLastSetValue = best.baseValue;

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
    dropRandomTroops(game, playerId, best.baseValue, deposits);
  }

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

export function advanceCapitalPlacement(game: Game, io: Server) {
  let index = game.turnPlayerIndex + 1;
  while (
    index < game.playerIds.length &&
    game.surrenderedIds.has(game.playerIds[index])
  )
    index++;

  if (index >= game.playerIds.length) {
    startTurns(game, io);
    checkGameEnd(game);
  } else {
    game.turnPlayerIndex = index;
    scheduleTurnTimer(game, io);
  }
}

export function startCapitalPlacement(game: Game, io: Server) {
  game.turnNumber = 0;
  game.turnPlayerIndex = 0;
  game.turnPhase = 'capital';
  game.capitalTerritoryIds = new Set();
  io.to(gameRoomName(game.name)).emit('game:capitalPlacementStarted');
  scheduleTurnTimer(game, io);
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

export function forceEndTurn(game: Game, io: Server) {
  const room = gameRoomName(game.name);
  const playerId = game.playerIds[game.turnPlayerIndex];

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
    advanceCapitalPlacement(game, io);
    return;
  }

  if (game.turnPhase === 'deploy') {
    const deposits = forceCompleteDeployPhase(game);
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
  advanceToNextPlayer(game, io);
}

function nextAlivePlayerIndex(game: Game): number {
  const playerCount = game.playerIds.length;
  let index = game.turnPlayerIndex;
  for (let i = 0; i < playerCount; i++) {
    index = (index + 1) % playerCount;
    if (index === 0) game.turnNumber++;
    const playerId = game.playerIds[index];
    if (ownsAnyTerritory(game, playerId) && !game.surrenderedIds.has(playerId))
      return index;
  }
  return game.turnPlayerIndex;
}

export function advanceToNextPlayer(game: Game, io: Server) {
  const endingPlayerId = game.playerIds[game.turnPlayerIndex];
  bumpStat(game, endingPlayerId, 'turnsPlayed');

  if (game.conqueredThisTurn) {
    const card = popRandomCard(game.deck);
    if (card) {
      game.playerCards.get(endingPlayerId)?.push(card);
      bumpStat(game, endingPlayerId, 'cardsGained');
    }
  }
  game.conqueredThisTurn = false;

  const nextIndex = nextAlivePlayerIndex(game);

  // Advancing to a new round is the only place `turnNumber` itself can
  // cross the Capitals-mode win gate (see `checkGameEnd`) without any
  // territory changing hands — e.g. a player already holding every capital
  // when the game enters its 3rd round. Re-check here so that win doesn't
  // sit unnoticed until the next conquest or surrender happens to trigger it.
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
  scheduleTurnTimer(game, io);
}

export function advanceTurnPhase(game: Game, io: Server) {
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
      advanceTurnPhase(game, io);
    } else if (game.turnPhase === 'fortify' && !hasAnyFortify(game, playerId)) {
      advanceTurnPhase(game, io);
    }
  } else {
    advanceToNextPlayer(game, io);
  }
}

export function startTurns(game: Game, io: Server) {
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
  scheduleTurnTimer(game, io);
}
