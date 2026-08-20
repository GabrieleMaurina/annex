import { Game } from '../../types';
import { ownsAnyTerritory } from './mechanics';
import { bumpStat, computeFinalRanking } from './stats';
import { clearTurnTimer } from './turns';

// `turnNumber` counts full rounds completed, so `2` means the game is now
// in its 3rd round.
const CAPITALS_WIN_MIN_TURN_NUMBER = 2;

export function checkGameEnd(game: Game, turnAlreadyEnded = false): void {
  if (game.state === 'ended') return;

  const activePlayers = game.playerIds.filter(
    (id) => !game.surrenderedIds.has(id) && ownsAnyTerritory(game, id),
  );
  const owners = [...new Set(game.territoryOwners.values())];

  let winnerIds: number[];
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winnerIds =
      game.gameMode === 'Team Deathmatch'
        ? game.playerIds.filter(
            (id) =>
              (game.playerTeams.get(id) ?? 0) ===
              (game.playerTeams.get(winner) ?? 0),
          )
        : [winner];
  } else if (game.gameMode === 'Team Deathmatch') {
    const teams = new Set(owners.map((id) => game.playerTeams.get(id) ?? 0));
    if (teams.size !== 1) return;
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
      if (winnerId === undefined) return;
      if (game.turnNumber < CAPITALS_WIN_MIN_TURN_NUMBER) return;
      winnerIds = [winnerId];
    }
  } else {
    if (owners.length !== 1) return;
    winnerIds = owners;
  }

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
}
