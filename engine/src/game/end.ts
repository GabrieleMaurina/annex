import { revealBotProfiles } from '../bots/reveal';
import { callbacks } from '../callbacks';
import { broadcastGameResults, broadcastHomeGames } from '../session/store';
import { Game } from '../types';
import { ownsAnyTerritory, supremacyTerritoriesToWin } from './mechanics';
import { missionAccomplished } from './progression/missions';
import { isPointsMode, pointsWinner } from './progression/points';
import {
  bumpStat,
  compareByPointsFirst,
  compareByTerritoriesFirst,
  computeFinalRanking,
  computeKillsWinner,
  countTerritories,
} from './progression/stats';
import { refreshLastReplayPlayerStates } from './replay';
import { clearTurnTimer } from './turns';
import { continentTerritoryIds } from './world/continent';

const EARLY_WIN_GATE_ROUND_NUMBER = 3;
export const HUMANS_ABANDONED_GRACE_MS = 5000;

function emitGameEnded(game: Game): void {
  const seen = new Set<number>();
  const ranking: { playerId: number; team: number }[] = [];
  for (const id of game.finalRanking) {
    if (seen.has(id)) continue;
    seen.add(id);
    ranking.push({ playerId: id, team: game.playerTeams.get(id) ?? 0 });
  }
  callbacks.onGameEnded?.({
    gameName: game.name,
    gameMode: game.gameMode,
    roundNumber: game.roundNumber,
    ranking,
  });
}

export function endAbandonedGame(game: Game): void {
  if (game.state !== 'playing') return;
  game.state = 'ended';
  game.endedAt = Date.now();
  revealBotProfiles(game);
  if (!game.earlyWin) game.finalRanking = computeFinalRanking(game);
  emitGameEnded(game);
}

function soleSurvivorWinnerIds(game: Game, winner: number): number[] {
  if (game.gameMode === 'team deathmatch') {
    return game.playerIds.filter(
      (id) =>
        (game.playerTeams.get(id) ?? 0) ===
          (game.playerTeams.get(winner) ?? 0) && !game.surrenderedIds.has(id),
    );
  }
  if (game.gameMode === 'player kills' || game.gameMode === 'troop kills') {
    return [computeKillsWinner(game)];
  }
  return [winner];
}

export function computeGameEndWinnerIds(game: Game): number[] | null {
  if (game.turnPhase === 'territory') {
    const remaining = game.playerIds.filter(
      (id) => !isPlayerEliminated(game, id),
    );
    if (remaining.length !== 1) return null;
    return soleSurvivorWinnerIds(game, remaining[0]);
  }
  return checkNonTerritoryPhaseWinner(game);
}

function isPlayerEliminated(game: Game, id: number): boolean {
  return game.deathOrder.includes(id);
}

function isLobbyBot(id: number): boolean {
  return id < 0;
}

function noHumanPlayersLeft(game: Game) {
  if (game.offline) return false;
  return game.playerIds.every(
    (id) => isPlayerEliminated(game, id) || isLobbyBot(id),
  );
}

function humansAbandonedGraceElapsed(game: Game): boolean {
  if (!noHumanPlayersLeft(game)) {
    game.humansAbandonedAt = null;
    return false;
  }
  if (game.humansAbandonedAt === null) {
    game.humansAbandonedAt = Date.now();
    return false;
  }
  return Date.now() - game.humansAbandonedAt >= HUMANS_ABANDONED_GRACE_MS;
}

function abandonedByHumansWinnerIds(game: Game): number[] | null {
  if (!humansAbandonedGraceElapsed(game)) return null;
  const activeIds = game.playerIds.filter(
    (id) => !isPlayerEliminated(game, id),
  );
  if (activeIds.length === 0) return null;
  const compare = isPointsMode(game.gameMode)
    ? compareByPointsFirst
    : compareByTerritoriesFirst;
  const leader = [...activeIds].sort((a, b) => compare(game, a, b))[0];
  return soleSurvivorWinnerIds(game, leader);
}

function isOpponent(game: Game, ownerId: number, survivorId: number): boolean {
  if (game.gameMode !== 'team deathmatch') return ownerId !== survivorId;
  return game.playerTeams.get(ownerId) !== game.playerTeams.get(survivorId);
}

function continuingHumanSurvivorId(game: Game): number | null {
  const alive = game.playerIds.filter(
    (id) => !isPlayerEliminated(game, id) && ownsAnyTerritory(game, id),
  );
  if (alive.length !== 1 || isLobbyBot(alive[0])) return null;
  const opponentOwnsTerritory = [...game.territoryOwners.values()].some(
    (ownerId) => isOpponent(game, ownerId, alive[0]),
  );
  return opponentOwnsTerritory ? alive[0] : null;
}

function lockEarlyWin(game: Game, winnerIds: number[]): void {
  game.earlyWin = true;
  game.winnerIds = winnerIds;
  game.finalRanking = computeFinalRanking(game);
}

function resolveWinnerIds(game: Game): number[] | null {
  const survivorId = continuingHumanSurvivorId(game);
  if (game.earlyWin) return survivorId === null ? game.winnerIds : null;
  const winnerIds = computeGameEndWinnerIds(game);
  if (winnerIds === null) return abandonedByHumansWinnerIds(game);
  if (survivorId === null || !winnerIds.includes(survivorId)) return winnerIds;
  lockEarlyWin(game, winnerIds);
  return null;
}

export function checkGameEnd(game: Game, turnAlreadyEnded = false): void {
  if (game.state === 'ended') return;

  const winnerIds = resolveWinnerIds(game);
  if (winnerIds !== null) finishGame(game, winnerIds, turnAlreadyEnded);
}

export function finishGame(
  game: Game,
  winnerIds: number[],
  turnAlreadyEnded = false,
): void {
  game.state = 'ended';
  game.endedAt = Date.now();
  if (!game.earlyWin) game.winnerIds = winnerIds;
  refreshLastReplayPlayerStates(game);
  revealBotProfiles(game);
  if (!turnAlreadyEnded) {
    const currentPlayerId = game.playerIds[game.turnPlayerIndex];
    if (ownsAnyTerritory(game, currentPlayerId))
      bumpStat(game, currentPlayerId, 'turnsPlayed');
  }
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  clearTurnTimer(game.name);
  if (!game.earlyWin) game.finalRanking = computeFinalRanking(game);
  emitGameEnded(game);
  broadcastHomeGames();
  broadcastGameResults(game);
}

function checkNonTerritoryPhaseWinner(game: Game): number[] | null {
  const activePlayers = game.playerIds.filter(
    (id) => !isPlayerEliminated(game, id) && ownsAnyTerritory(game, id),
  );
  const owners = [...new Set(game.territoryOwners.values())];

  let winnerIds: number[];
  if (activePlayers.length === 1) {
    winnerIds = soleSurvivorWinnerIds(game, activePlayers[0]);
  } else if (game.gameMode === 'team deathmatch') {
    const teams = new Set(owners.map((id) => game.playerTeams.get(id) ?? 0));
    if (teams.size !== 1) return null;
    const winningTeam = [...teams][0];
    winnerIds = game.playerIds.filter(
      (id) => (game.playerTeams.get(id) ?? 0) === winningTeam,
    );
  } else if (game.gameMode === 'capitals') {
    if (owners.length === 1) {
      winnerIds = owners;
    } else {
      const capitalOwners = [...game.capitalTerritoryIds].map((id) =>
        game.territoryOwners.get(id),
      );
      const uniqueOwners = new Set(capitalOwners);
      const winnerId =
        uniqueOwners.size === 1 ? [...uniqueOwners][0] : undefined;
      if (winnerId === undefined) return null;
      if (game.roundNumber < EARLY_WIN_GATE_ROUND_NUMBER) return null;
      winnerIds = [winnerId];
    }
  } else if (game.gameMode === 'continent') {
    const ids = continentTerritoryIds(game, game.continentId!).filter(
      (id) =>
        !game.territoryToxins.has(id) && !game.radiationTerritoryIds.has(id),
    );
    const continentOwners = new Set(
      ids.map((id) => game.territoryOwners.get(id)),
    );
    const continentWinnerId =
      ids.length > 0 && continentOwners.size === 1
        ? [...continentOwners][0]
        : undefined;
    if (continentWinnerId === undefined) return null;
    if (game.roundNumber < EARLY_WIN_GATE_ROUND_NUMBER) return null;
    winnerIds = [continentWinnerId];
  } else if (
    game.gameMode === 'supremacy 3/4' ||
    game.gameMode === 'supremacy 2/3'
  ) {
    const threshold = supremacyTerritoriesToWin(game)!;
    const winner = activePlayers.find(
      (id) => countTerritories(game, id) >= threshold,
    );
    if (winner === undefined) return null;
    winnerIds = [winner];
  } else if (game.gameMode === '5-round' || game.gameMode === '10-round') {
    const roundLimit = game.gameMode === '5-round' ? 5 : 10;
    if (game.roundNumber < roundLimit) return null;
    winnerIds = [
      [...activePlayers].sort((a, b) =>
        compareByTerritoriesFirst(game, a, b),
      )[0],
    ];
  } else if (isPointsMode(game.gameMode)) {
    const winner =
      owners.length === 1 ? owners[0] : pointsWinner(game, activePlayers);
    if (winner === undefined) return null;
    winnerIds = [winner];
  } else if (game.gameMode === 'assassin' || game.gameMode === 'mission') {
    const winner = activePlayers.find((id) => {
      const mission = game.playerMissions.get(id);
      return mission !== undefined && missionAccomplished(game, id, mission);
    });
    if (winner === undefined) return null;
    winnerIds = [winner];
  } else {
    if (owners.length !== 1) return null;
    winnerIds = owners;
  }

  return winnerIds.filter((id) => !game.surrenderedIds.has(id));
}
