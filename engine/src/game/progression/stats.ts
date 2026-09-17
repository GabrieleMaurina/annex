import { Game, PlayerStats } from '../../types';
import { ownsAnyTerritory } from '../mechanics';

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
  attackerId?: number,
): boolean {
  const eliminated = !ownsAnyTerritory(game, defenderId);
  if (eliminated && !game.deathOrder.includes(defenderId)) {
    game.deathOrder.push(defenderId);
    if (attackerId !== undefined)
      game.stats.get(attackerId)?.playersKilled.push(defenderId);
    for (const [seaTerritoryId, shipsByPlayer] of game.seaShips) {
      shipsByPlayer.delete(defenderId);
      if (shipsByPlayer.size === 0) game.seaShips.delete(seaTerritoryId);
    }
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

export function findKillerId(game: Game, targetId: number): number | undefined {
  return game.playerIds.find((id) =>
    game.stats.get(id)!.playersKilled.includes(targetId),
  );
}

export function countTerritories(game: Game, playerId: number): number {
  let count = 0;
  for (const ownerId of game.territoryOwners.values()) {
    if (ownerId === playerId) count++;
  }
  return count;
}

function frozenOrLive(game: Game, playerId: number, liveValue: number): number {
  return game.frozenKillCount.get(playerId) ?? liveValue;
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

export function compareByTerritoriesFirst(
  game: Game,
  a: number,
  b: number,
): number {
  const territoriesA = countTerritories(game, a);
  const territoriesB = countTerritories(game, b);
  if (territoriesA !== territoriesB) return territoriesB - territoriesA;
  const sa = game.stats.get(a)!;
  const sb = game.stats.get(b)!;
  if (sa.playersKilled.length !== sb.playersKilled.length)
    return sb.playersKilled.length - sa.playersKilled.length;
  if (sa.troopsKilled !== sb.troopsKilled)
    return sb.troopsKilled - sa.troopsKilled;
  return sb.troopsGained - sa.troopsGained;
}

function compareByDeathOrder(game: Game, a: number, b: number): number {
  const rank = (id: number) => {
    const index = game.deathOrder.indexOf(id);
    return index === -1 ? -1 : game.deathOrder.length - index;
  };
  return rank(a) - rank(b);
}

function compareByPlayerKillsFirst(game: Game, a: number, b: number): number {
  const sa = frozenOrLive(game, a, game.stats.get(a)!.playersKilled.length);
  const sb = frozenOrLive(game, b, game.stats.get(b)!.playersKilled.length);
  if (sa !== sb) return sb - sa;
  const deathCmp = compareByDeathOrder(game, a, b);
  if (deathCmp !== 0) return deathCmp;
  return compareBySurvivorTiebreak(game, a, b);
}

function compareByTroopKillsFirst(game: Game, a: number, b: number): number {
  const sa = frozenOrLive(game, a, game.stats.get(a)!.troopsKilled);
  const sb = frozenOrLive(game, b, game.stats.get(b)!.troopsKilled);
  if (sa !== sb) return sb - sa;
  const deathCmp = compareByDeathOrder(game, a, b);
  if (deathCmp !== 0) return deathCmp;
  return compareBySurvivorTiebreak(game, a, b);
}

function killsComparator(game: Game): (a: number, b: number) => number {
  const compare =
    game.gameMode === 'Troop Kills'
      ? compareByTroopKillsFirst
      : compareByPlayerKillsFirst;
  return (a, b) => compare(game, a, b);
}

export function computeKillsWinner(game: Game): number {
  const candidates = game.playerIds.filter(
    (id) => !game.surrenderedIds.has(id),
  );
  return candidates.sort(killsComparator(game))[0];
}

function computeTeamRanking(game: Game): number[] {
  const winningTeam =
    game.winnerIds.length > 0
      ? (game.playerTeams.get(game.winnerIds[0]) ?? 0)
      : null;
  const deadTeamsDesc = [...game.teamDeathOrder].reverse();
  const knownTeams =
    winningTeam !== null ? [winningTeam, ...deadTeamsDesc] : deadTeamsDesc;
  const allTeams = new Set(
    game.playerIds.map((id) => game.playerTeams.get(id) ?? 0),
  );
  const teamOrder = [
    ...knownTeams,
    ...[...allTeams].filter((team) => !knownTeams.includes(team)),
  ];
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
        return aliveA === 1
          ? compareBySurvivorTiebreak(game, a, b)
          : compareByDeathOrder(game, a, b);
      }),
    );
  }
  return ranking;
}

export function computeFinalRanking(game: Game): number[] {
  if (game.gameMode === 'Team Deathmatch') return computeTeamRanking(game);
  if (game.gameMode === 'Player Kills' || game.gameMode === 'Troop Kills') {
    const comparator = killsComparator(game);
    const contenders = game.playerIds
      .filter((id) => !game.surrenderedIds.has(id))
      .sort(comparator);
    const surrendered = game.playerIds
      .filter((id) => game.surrenderedIds.has(id))
      .sort(comparator);
    return [...contenders, ...surrendered];
  }

  const tiebreak =
    game.gameMode === '5-Round' || game.gameMode === '10-Round'
      ? compareByTerritoriesFirst
      : compareBySurvivorTiebreak;

  const deadRanked = [...game.deathOrder]
    .reverse()
    .filter((id) => !game.winnerIds.includes(id));
  const known = new Set([...game.winnerIds, ...deadRanked]);
  const aliveNonWinners = game.playerIds
    .filter((id) => !known.has(id))
    .sort((a, b) => tiebreak(game, a, b));
  return [...game.winnerIds, ...aliveNonWinners, ...deadRanked];
}
