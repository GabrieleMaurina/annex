import { Game, PlayerStats } from '../../types';
import { ownsAnyTerritory } from './mechanics';

export function emptyPlayerStats(): PlayerStats {
  return {
    troopsGained: 0,
    troopsKilled: 0,
    troopsLost: 0,
    territoriesConquered: 0,
    territoriesLost: 0,
    capitalsConquered: 0,
    capitalsLost: 0,
    cardsGained: 0,
    playersKilled: [],
    turnsPlayed: 0,
    setsPlayed: 0,
  };
}

type NumericStat = {
  [K in keyof PlayerStats]: PlayerStats[K] extends number ? K : never;
}[keyof PlayerStats];

export function bumpStat(
  game: Game,
  playerId: number,
  field: NumericStat,
  amount = 1,
) {
  game.stats.get(playerId)![field] += amount;
}

export function recordElimination(
  game: Game,
  defenderId: number,
  attackerId: number,
): boolean {
  const eliminated = !ownsAnyTerritory(game, defenderId);
  if (eliminated && !game.deathOrder.includes(defenderId)) {
    game.deathOrder.push(defenderId);
    game.stats.get(attackerId)?.playersKilled.push(defenderId);
  }

  if (game.gameMode === 'Team Deathmatch') {
    const team = game.playerTeams.get(defenderId) ?? 0;
    const teamAlive = [...game.territoryOwners.values()].some(
      (id) => (game.playerTeams.get(id) ?? 0) === team,
    );
    if (!teamAlive && !game.teamDeathOrder.includes(team)) {
      game.teamDeathOrder.push(team);
    }
  }

  return eliminated;
}

function countTerritories(game: Game, playerId: number): number {
  let count = 0;
  for (const ownerId of game.territoryOwners.values()) {
    if (ownerId === playerId) count++;
  }
  return count;
}

function compareBySurvivorTiebreak(game: Game, a: number, b: number): number {
  const sa = game.stats.get(a)!;
  const sb = game.stats.get(b)!;
  if (sa.playersKilled.length !== sb.playersKilled.length)
    return sb.playersKilled.length - sa.playersKilled.length;
  const territoriesA = countTerritories(game, a);
  const territoriesB = countTerritories(game, b);
  if (territoriesA !== territoriesB) return territoriesB - territoriesA;
  if (sa.troopsKilled !== sb.troopsKilled)
    return sb.troopsKilled - sa.troopsKilled;
  return sb.troopsGained - sa.troopsGained;
}

function computeTeamRanking(game: Game): number[] {
  const winningTeam = game.playerTeams.get(game.winnerIds[0]) ?? 0;
  const teamOrder = [winningTeam, ...[...game.teamDeathOrder].reverse()];
  const ranking: number[] = [];
  for (const team of teamOrder) {
    const members = game.playerIds.filter(
      (id) => (game.playerTeams.get(id) ?? 0) === team,
    );
    ranking.push(
      ...members.sort((a, b) => {
        const aliveA = game.deathOrder.includes(a) ? 0 : 1;
        const aliveB = game.deathOrder.includes(b) ? 0 : 1;
        if (aliveA !== aliveB) return aliveB - aliveA;
        return compareBySurvivorTiebreak(game, a, b);
      }),
    );
  }
  return ranking;
}

export function computeFinalRanking(game: Game): number[] {
  if (game.gameMode === 'Team Deathmatch') return computeTeamRanking(game);

  const deadRanked = [...game.deathOrder]
    .reverse()
    .filter((id) => !game.winnerIds.includes(id));
  const known = new Set([...game.winnerIds, ...deadRanked]);
  const aliveNonWinners = game.playerIds
    .filter((id) => !known.has(id))
    .sort((a, b) => compareBySurvivorTiebreak(game, a, b));
  return [...game.winnerIds, ...aliveNonWinners, ...deadRanked];
}
