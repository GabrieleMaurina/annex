import { Game } from '../types';
import { clearTurnTimer } from './turns';

export function checkGameEnd(game: Game): void {
  const owners = [...new Set(game.territoryOwners.values())];

  let winnerIds: number[];
  if (game.gameMode === 'Team Deathmatch') {
    const teams = new Set(owners.map((id) => game.playerTeams.get(id) ?? 0));
    if (teams.size !== 1) return;
    const winningTeam = [...teams][0];
    winnerIds = game.playerIds.filter(
      (id) => (game.playerTeams.get(id) ?? 0) === winningTeam,
    );
  } else {
    if (owners.length !== 1) return;
    winnerIds = owners;
  }

  game.state = 'ended';
  game.winnerIds = winnerIds;
  game.turnPhase = 'deploy';
  game.selectedTerritoryId = null;
  game.fortifyStartTerritoryId = null;
  game.fortifyEndTerritoryId = null;
  game.attackStartTerritoryId = null;
  game.attackEndTerritoryId = null;
  game.attackConquestMinTroops = null;
  clearTurnTimer(game.name);
}
