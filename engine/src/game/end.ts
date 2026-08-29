import { playersById } from '../session/players';
import { broadcastGameResults, broadcastHomeGames } from '../session/store';
import { Game } from '../types';
import { ownsAnyTerritory } from './mechanics';
import { missionAccomplished } from './progression/missions';
import {
  bumpStat,
  compareByTerritoriesFirst,
  computeFinalRanking,
  computeKillsWinner,
  countTerritories,
} from './progression/stats';
import { clearTurnTimer } from './turns';
import { continentTerritoryIds } from './world/continent';

const EARLY_WIN_GATE_TURN_NUMBER = 2;

function soleSurvivorWinnerIds(game: Game, winner: number): number[] {
  if (game.gameMode === 'Team Deathmatch') {
    return game.playerIds.filter(
      (id) =>
        (game.playerTeams.get(id) ?? 0) === (game.playerTeams.get(winner) ?? 0),
    );
  }
  if (game.gameMode === 'Player Kills' || game.gameMode === 'Troop Kills') {
    return [computeKillsWinner(game)];
  }
  return [winner];
}

export function computeGameEndWinnerIds(game: Game): number[] | null {
  if (game.turnPhase === 'territory') {
    const remaining = game.playerIds.filter(
      (id) => !game.surrenderedIds.has(id) && !game.deathOrder.includes(id),
    );
    if (remaining.length !== 1) return null;
    return soleSurvivorWinnerIds(game, remaining[0]);
  }
  return checkNonTerritoryPhaseWinner(game);
}

function isPlayerEliminated(game: Game, id: number): boolean {
  return game.surrenderedIds.has(id) || game.deathOrder.includes(id);
}

// A human can leave the game by being killed, surrendering, or disconnecting
// (disconnect turns their seat into a takeover bot, so isBot covers it too).
// Once none remain, there's no one left to keep the game running for.
function noHumanPlayersLeft(game: Game) {
  return game.playerIds.every(
    (id) =>
      isPlayerEliminated(game, id) || (playersById.get(id)?.isBot ?? true),
  );
}

function abandonedByHumansWinnerIds(game: Game): number[] | null {
  if (!noHumanPlayersLeft(game)) return null;
  const activeIds = game.playerIds.filter(
    (id) => !isPlayerEliminated(game, id),
  );
  if (activeIds.length === 0) return null;
  const leader = [...activeIds].sort((a, b) =>
    compareByTerritoriesFirst(game, a, b),
  )[0];
  return soleSurvivorWinnerIds(game, leader);
}

export function checkGameEnd(game: Game, turnAlreadyEnded = false): void {
  if (game.state === 'ended') return;

  const winnerIds =
    computeGameEndWinnerIds(game) ?? abandonedByHumansWinnerIds(game);
  if (winnerIds === null) return;

  game.state = 'ended';
  game.winnerIds = winnerIds;
  if (!turnAlreadyEnded) {
    const currentPlayerId = game.playerIds[game.turnPlayerIndex];
    if (
      !game.surrenderedIds.has(currentPlayerId) &&
      ownsAnyTerritory(game, currentPlayerId)
    )
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
  game.finalRanking = computeFinalRanking(game);
  broadcastHomeGames();
  broadcastGameResults(game);
}

function checkNonTerritoryPhaseWinner(game: Game): number[] | null {
  const activePlayers = game.playerIds.filter(
    (id) => !game.surrenderedIds.has(id) && ownsAnyTerritory(game, id),
  );
  const owners = [...new Set(game.territoryOwners.values())];

  let winnerIds: number[];
  if (activePlayers.length === 1) {
    winnerIds = soleSurvivorWinnerIds(game, activePlayers[0]);
  } else if (game.gameMode === 'Team Deathmatch') {
    const teams = new Set(owners.map((id) => game.playerTeams.get(id) ?? 0));
    if (teams.size !== 1) return null;
    const winningTeam = [...teams][0];
    winnerIds = game.playerIds.filter(
      (id) => (game.playerTeams.get(id) ?? 0) === winningTeam,
    );
  } else if (game.gameMode === 'Capitals') {
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
      if (game.turnNumber < EARLY_WIN_GATE_TURN_NUMBER) return null;
      winnerIds = [winnerId];
    }
  } else if (game.gameMode === 'Continent') {
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
    if (game.turnNumber < EARLY_WIN_GATE_TURN_NUMBER) return null;
    winnerIds = [continentWinnerId];
  } else if (
    game.gameMode === 'Supremacy 3/4' ||
    game.gameMode === 'Supremacy 2/3'
  ) {
    const fraction = game.gameMode === 'Supremacy 3/4' ? 3 / 4 : 2 / 3;
    const threshold = Math.ceil(game.territoryOwners.size * fraction);
    const winner = activePlayers.find(
      (id) => countTerritories(game, id) >= threshold,
    );
    if (winner === undefined) return null;
    winnerIds = [winner];
  } else if (game.gameMode === '5-Turn' || game.gameMode === '10-Turn') {
    const turnLimit = game.gameMode === '5-Turn' ? 5 : 10;
    if (game.turnNumber < turnLimit) return null;
    winnerIds = [
      [...activePlayers].sort((a, b) =>
        compareByTerritoriesFirst(game, a, b),
      )[0],
    ];
  } else if (game.gameMode === 'Assassin' || game.gameMode === 'Mission') {
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

  return winnerIds;
}
