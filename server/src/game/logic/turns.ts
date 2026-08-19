import { Game, TurnPhase } from '../../types';
import { calculateDeployTroops } from './mechanics';

const PHASE_ORDER: TurnPhase[] = ['deploy', 'attack', 'fortify'];

const turnTimers = new Map<string, NodeJS.Timeout>();

export function clearTurnTimer(gameName: string) {
  const timer = turnTimers.get(gameName);
  if (timer) clearTimeout(timer);
  turnTimers.delete(gameName);
}

function scheduleTurnTimer(game: Game) {
  clearTurnTimer(game.name);
  game.turnStartedAt = Date.now();
  const timer = setTimeout(() => forceEndTurn(game), game.turnDuration * 1000);
  turnTimers.set(game.name, timer);
}

function randomDeployRemainingTroops(game: Game) {
  const playerId = game.playerIds[game.turnPlayerIndex];
  const territoryIds = [...game.territoryOwners.entries()]
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([territoryId]) => territoryId);
  if (territoryIds.length === 0) return;

  while (game.troopsToDeploy > 0) {
    const territoryId =
      territoryIds[Math.floor(Math.random() * territoryIds.length)];
    game.territoryTroops.set(
      territoryId,
      (game.territoryTroops.get(territoryId) ?? 0) + 1,
    );
    game.troopsToDeploy--;
  }
}

function completePendingAttackMove(game: Game) {
  if (game.attackConquestMinTroops === null) return;

  const startId = game.attackStartTerritoryId!;
  const endId = game.attackEndTerritoryId!;
  const troops = game.attackConquestMinTroops;
  const startTroops = game.territoryTroops.get(startId) ?? 0;

  game.territoryTroops.set(startId, startTroops - troops);
  game.territoryTroops.set(endId, troops);
}

function completePendingFortify(game: Game) {
  if (
    game.fortifyStartTerritoryId === null ||
    game.fortifyEndTerritoryId === null
  )
    return;

  const startId = game.fortifyStartTerritoryId;
  const endId = game.fortifyEndTerritoryId;
  const startTroops = game.territoryTroops.get(startId) ?? 0;

  game.territoryTroops.set(startId, startTroops - 1);
  game.territoryTroops.set(endId, (game.territoryTroops.get(endId) ?? 0) + 1);
}

function forceEndTurn(game: Game) {
  if (game.turnPhase === 'deploy') randomDeployRemainingTroops(game);
  if (game.turnPhase === 'attack') completePendingAttackMove(game);
  if (game.turnPhase === 'fortify') completePendingFortify(game);
  advanceToNextPlayer(game);
}

export function advanceToNextPlayer(game: Game) {
  const nextIndex = (game.turnPlayerIndex + 1) % game.playerIds.length;
  if (nextIndex === 0) game.turnNumber++;
  game.turnPlayerIndex = nextIndex;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  game.troopsToDeploy = calculateDeployTroops(game, game.playerIds[nextIndex]);
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
  } else {
    advanceToNextPlayer(game);
  }
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
  game.troopsToDeploy = calculateDeployTroops(game, game.playerIds[0]);
  scheduleTurnTimer(game);
}
