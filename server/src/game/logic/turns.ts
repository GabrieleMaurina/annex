import { Server } from 'socket.io';
import { Game, TurnPhase } from '../../types';
import { hasAnyAttack, hasAnyFortify } from './autoSkip';
import { pickBestSet, popRandomCard, returnCardsToDeck } from './cards';
import { calculateDeployTroops } from './mechanics';
import { gameRoomName } from './rooms';

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
  const timer = setTimeout(
    () => forceEndTurn(game, io),
    game.turnDuration * 1000,
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

  while (amount > 0) {
    const territoryId =
      territoryIds[Math.floor(Math.random() * territoryIds.length)];
    game.territoryTroops.set(
      territoryId,
      (game.territoryTroops.get(territoryId) ?? 0) + 1,
    );
    deposits.set(territoryId, (deposits.get(territoryId) ?? 0) + 1);
    amount--;
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
    if (game.cards === 'Exponential') game.cardsLastSetValue = best.baseValue;

    for (const territoryId of best.territoryBonusIds) {
      game.territoryTroops.set(
        territoryId,
        (game.territoryTroops.get(territoryId) ?? 0) + 2,
      );
      deposits.set(territoryId, (deposits.get(territoryId) ?? 0) + 2);
    }
    dropRandomTroops(game, playerId, best.baseValue, deposits);
  }

  return deposits;
}

function completePendingAttackMove(
  game: Game,
): { territoryId: number; troops: number } | null {
  if (game.attackConquestMinTroops === null) return null;

  const startId = game.attackStartTerritoryId!;
  const endId = game.attackEndTerritoryId!;
  const troops = game.attackConquestMinTroops;
  const startTroops = game.territoryTroops.get(startId) ?? 0;

  game.territoryTroops.set(startId, startTroops - troops);
  game.territoryTroops.set(endId, troops);
  return { territoryId: endId, troops };
}

function completePendingFortify(
  game: Game,
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
  return { territoryId: endId, troops: 1 };
}

function forceEndTurn(game: Game, io: Server) {
  const room = gameRoomName(game.name);

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
    const move = completePendingAttackMove(game);
    if (move) io.to(room).emit('game:attackMoved', move);
  }
  if (game.turnPhase === 'fortify') {
    const move = completePendingFortify(game);
    if (move) io.to(room).emit('game:fortified', move);
  }
  advanceToNextPlayer(game, io);
}

function ownsAnyTerritory(game: Game, playerId: number): boolean {
  for (const ownerId of game.territoryOwners.values()) {
    if (ownerId === playerId) return true;
  }
  return false;
}

function nextAlivePlayerIndex(game: Game): number {
  const playerCount = game.playerIds.length;
  let index = game.turnPlayerIndex;
  for (let i = 0; i < playerCount; i++) {
    index = (index + 1) % playerCount;
    if (index === 0) game.turnNumber++;
    if (ownsAnyTerritory(game, game.playerIds[index])) return index;
  }
  return game.turnPlayerIndex;
}

export function advanceToNextPlayer(game: Game, io: Server) {
  if (game.conqueredThisTurn) {
    const endingPlayerId = game.playerIds[game.turnPlayerIndex];
    const card = popRandomCard(game.deck);
    if (card) game.playerCards.get(endingPlayerId)?.push(card);
  }
  game.conqueredThisTurn = false;

  const nextIndex = nextAlivePlayerIndex(game);
  game.turnPlayerIndex = nextIndex;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  game.troopsToDeploy = calculateDeployTroops(game, game.playerIds[nextIndex]);
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
  game.troopsToDeploy = calculateDeployTroops(game, game.playerIds[0]);
  scheduleTurnTimer(game, io);
}
