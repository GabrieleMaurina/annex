import { playersById } from '../../session/players';
import { AchievementFacts, Game, PlayerStats } from '../../types';
import type { DiceLuck } from '../combat/dice';
import { ownsAnyTerritory } from '../mechanics';
import { hasPlayableSet } from './cards';
import { isPointsMode } from './points';

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
    cardsStolen: 0,
    playersKilled: [],
    turnsPlayed: 0,
    setsPlayed: 0,
    setsOnThree: 0,
    turnsOnThree: 0,
    luckSurplus: 0,
    luckVariance: 0,
    peakTurnTroops: 0,
    peakTerritories: 0,
    cornered: false,
    turnConquests: 0,
    peakTurnConquests: 0,
    peakSetTroops: 0,
    nukesLaunched: 0,
    fleetsSunk: 0,
    alliancesFormed: 0,
    lastPlayedRound: null,
  };
}

const CORNERED_TERRITORIES = 3;
const SET_SIZE = 3;
const AVERAGE_LUCK = 0;
const LOGISTIC_NORMAL_SCALE = 1.7;

export function isBotControlled(playerId: number): boolean {
  return playersById.get(playerId)?.isBot ?? false;
}

export function recordTurnStart(game: Game, playerId: number, troops: number) {
  const stats = game.stats.get(playerId)!;
  stats.turnConquests = 0;
  const hand = game.playerCards.get(playerId) ?? [];
  if (hand.length === SET_SIZE) {
    stats.turnsOnThree++;
    if (hasPlayableSet(hand)) stats.setsOnThree++;
  }
  if (isBotControlled(playerId)) return;
  const territories = countTerritories(game, playerId);
  if (
    territories <= CORNERED_TERRITORIES &&
    stats.peakTerritories > CORNERED_TERRITORIES
  )
    stats.cornered = true;
  stats.peakTerritories = Math.max(stats.peakTerritories, territories);
  stats.peakTurnTroops = Math.max(stats.peakTurnTroops, troops);
}

export function recordConquest(stats: PlayerStats, playerId: number) {
  stats.territoriesConquered++;
  if (isBotControlled(playerId)) return;
  stats.turnConquests++;
  stats.peakTurnConquests = Math.max(
    stats.peakTurnConquests,
    stats.turnConquests,
  );
}

export function recordCardSet(game: Game, playerId: number, troops: number) {
  const stats = game.stats.get(playerId)!;
  stats.setsPlayed++;
  if (!isBotControlled(playerId))
    stats.peakSetTroops = Math.max(stats.peakSetTroops, troops);
}

export function recordLuck(
  attacker: PlayerStats,
  defender: PlayerStats | undefined,
  luck: DiceLuck,
) {
  attacker.luckSurplus += luck.surplus;
  attacker.luckVariance += luck.variance;
  if (!defender) return;
  defender.luckSurplus -= luck.surplus;
  defender.luckVariance += luck.variance;
}

export function luckScore(game: Game, playerId: number): number {
  const stats = game.stats.get(playerId);
  if (!stats || stats.luckVariance <= 0) return AVERAGE_LUCK;
  const deviations = stats.luckSurplus / Math.sqrt(stats.luckVariance);
  const percentile = 1 / (1 + Math.exp(-LOGISTIC_NORMAL_SCALE * deviations));
  return Math.round(200 * percentile - 100);
}

function isSoleWinner(game: Game, playerId: number): boolean {
  return (
    !game.draw &&
    game.gameMode !== 'team deathmatch' &&
    game.winnerIds.length === 1 &&
    game.winnerIds[0] === playerId
  );
}

export function achievementFacts(
  game: Game,
  playerId: number,
  disconnected: boolean,
): AchievementFacts {
  const stats = game.stats.get(playerId) ?? emptyPlayerStats();
  return {
    won: isSoleWinner(game, playerId) && !disconnected,
    cornered: stats.cornered,
    peakTurnTroops: stats.peakTurnTroops,
    territoriesConquered: stats.territoriesConquered,
    playersKilled: stats.playersKilled.length,
    peakTurnConquests: stats.peakTurnConquests,
    peakSetTroops: stats.peakSetTroops,
    nukesLaunched: stats.nukesLaunched,
    fleetsSunk: stats.fleetsSunk,
    alliancesFormed: stats.alliancesFormed,
    lastPlayedRound: stats.lastPlayedRound,
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
  const stats = game.stats.get(playerId)!;
  stats[field] += amount;
  if (field === 'turnsPlayed' && !isBotControlled(playerId))
    stats.lastPlayedRound = game.roundNumber;
}

function recordAwayElimination(game: Game, playerId: number) {
  if (
    !playersById.get(playerId)?.connected &&
    (game.disconnectedTurns.get(playerId) ?? 0) >= 1
  )
    game.eliminatedWhileAwayIds.add(playerId);
}

export function recordElimination(
  game: Game,
  defenderId: number,
  attackerId?: number,
): boolean {
  const eliminated = !ownsAnyTerritory(game, defenderId);
  if (eliminated && !game.deathOrder.includes(defenderId)) {
    game.deathOrder.push(defenderId);
    recordAwayElimination(game, defenderId);
    if (attackerId !== undefined)
      game.stats.get(attackerId)?.playersKilled.push(defenderId);
    for (const [seaTerritoryId, shipsByPlayer] of game.seaShips) {
      shipsByPlayer.delete(defenderId);
      if (shipsByPlayer.size === 0) game.seaShips.delete(seaTerritoryId);
    }
  }

  if (game.gameMode === 'team deathmatch') {
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

export function compareByPointsFirst(game: Game, a: number, b: number): number {
  const pointsA = game.points.get(a) ?? 0;
  const pointsB = game.points.get(b) ?? 0;
  if (pointsA !== pointsB) return pointsB - pointsA;
  const deathCmp = compareByDeathOrder(game, a, b);
  if (deathCmp !== 0) return deathCmp;
  return compareBySurvivorTiebreak(game, a, b);
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
    game.gameMode === 'troop kills'
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
  const ranking = computeDecisiveRanking(game);
  if (!game.draw) return ranking;
  const drawnIds = game.draw.playerIds;
  return [
    ...ranking.filter((id) => drawnIds.includes(id)),
    ...ranking.filter((id) => !drawnIds.includes(id)),
  ];
}

function computeDecisiveRanking(game: Game): number[] {
  if (game.gameMode === 'team deathmatch') return computeTeamRanking(game);
  if (game.gameMode === 'player kills' || game.gameMode === 'troop kills') {
    const comparator = killsComparator(game);
    const contenders = game.playerIds
      .filter((id) => !game.surrenderedIds.has(id))
      .sort(comparator);
    const surrendered = game.playerIds
      .filter((id) => game.surrenderedIds.has(id))
      .sort(comparator);
    return [...contenders, ...surrendered];
  }

  if (isPointsMode(game.gameMode)) {
    const compare = (a: number, b: number) => compareByPointsFirst(game, a, b);
    const others = game.playerIds.filter((id) => !game.winnerIds.includes(id));
    return [
      ...game.winnerIds,
      ...others.filter((id) => !game.surrenderedIds.has(id)).sort(compare),
      ...others.filter((id) => game.surrenderedIds.has(id)).sort(compare),
    ];
  }

  const tiebreak =
    game.gameMode === '5-round' || game.gameMode === '10-round'
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
