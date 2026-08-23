import { Game, Player } from '../../types';
import { nextSetBaseValues, upcomingSetValues } from './cards';
import { emptyPlayerStats } from './stats';

const EMPTY_STATS = emptyPlayerStats();

function toSummaries(ids: number[], playersById: Map<number, Player>) {
  return ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => !!player)
    .map((player) => ({ id: player.id, name: player.name }));
}

function territoryStats(game: Game) {
  const stats = new Map<
    number,
    { territoryCount: number; troopCount: number; capitalCount: number }
  >();
  for (const [territoryId, ownerId] of game.territoryOwners) {
    const entry = stats.get(ownerId) ?? {
      territoryCount: 0,
      troopCount: 0,
      capitalCount: 0,
    };
    entry.territoryCount++;
    entry.troopCount += game.territoryTroops.get(territoryId) ?? 0;
    if (game.capitalTerritoryIds.has(territoryId)) entry.capitalCount++;
    stats.set(ownerId, entry);
  }
  return stats;
}

export function gameSummary(game: Game) {
  return {
    name: game.name,
    mapName: game.mapName,
    playerCount: game.playerIds.length,
    slots: game.slots,
    state: game.state,
    spectatorCount: game.spectatorIds.length,
  };
}

function captureConnectivityAtEnd(
  game: Game,
  playersById: Map<number, Player>,
) {
  if (game.state !== 'ended' || game.connectivitySnapshotTaken) return;
  game.connectivitySnapshotTaken = true;
  for (const id of game.playerIds) {
    const stats = game.stats.get(id);
    if (stats) stats.connectedAtEnd = playersById.get(id)?.connected ?? false;
  }
}

export function gameState(game: Game, playersById: Map<number, Player>) {
  captureConnectivityAtEnd(game, playersById);
  const stats = territoryStats(game);
  const turnPlayerId = game.playerIds[game.turnPlayerIndex];
  return {
    name: game.name,
    mapName: game.mapName,
    slots: game.slots,
    hostId: game.hostId,
    state: game.state,
    gameMode: game.gameMode,
    blitz: game.blitz,
    defenceDice: game.defenceDice,
    cards: game.cards,
    placement: game.placement,
    fortification: game.fortification,
    turnDuration: game.turnDuration,
    turnNumber: game.turnNumber,
    turnPlayerIndex: game.turnPlayerIndex,
    turnPhase: game.turnPhase,
    troopsToDeploy: game.troopsToDeploy,
    turnStartedAt: game.turnStartedAt,
    paused: game.paused,
    selectedTerritoryId: game.selectedTerritoryId,
    fortifyStartTerritoryId: game.fortifyStartTerritoryId,
    fortifyEndTerritoryId: game.fortifyEndTerritoryId,
    attackStartTerritoryId: game.attackStartTerritoryId,
    attackEndTerritoryId: game.attackEndTerritoryId,
    attackConquestMinTroops: game.attackConquestMinTroops,
    winnerIds: game.winnerIds,
    nextSetBaseValues: nextSetBaseValues(game, turnPlayerId),
    upcomingSetValues: upcomingSetValues(game, turnPlayerId, 3),
    finalRanking: game.finalRanking,
    players: toSummaries(game.playerIds, playersById).map((player) => {
      const territoryCount = stats.get(player.id)?.territoryCount ?? 0;
      const playerStats = game.stats.get(player.id) ?? EMPTY_STATS;
      return {
        ...player,
        team: game.playerTeams.get(player.id) ?? 0,
        color: game.playerColors.get(player.id) ?? 0,
        territoryCount,
        troopCount: stats.get(player.id)?.troopCount ?? 0,
        capitalCount: stats.get(player.id)?.capitalCount ?? 0,
        troopsRemaining:
          game.turnPhase === 'troop'
            ? (game.placementTroopPools.get(player.id) ?? 0)
            : 0,
        cardCount: game.playerCards.get(player.id)?.length ?? 0,
        connected: playersById.get(player.id)?.connected ?? false,
        connectedAtEnd: playerStats.connectedAtEnd,
        surrendered: game.surrenderedIds.has(player.id),
        eliminated:
          game.state !== 'lobby' &&
          game.turnPhase !== 'territory' &&
          territoryCount === 0,
        troopsGained: playerStats.troopsGained,
        troopsKilled: playerStats.troopsKilled,
        troopsLost: playerStats.troopsLost,
        territoriesConquered: playerStats.territoriesConquered,
        territoriesLost: playerStats.territoriesLost,
        capitalsConquered: playerStats.capitalsConquered,
        capitalsLost: playerStats.capitalsLost,
        cardsGained: playerStats.cardsGained,
        playersKilled: playerStats.playersKilled,
        turnsPlayed: playerStats.turnsPlayed,
        setsPlayed: playerStats.setsPlayed,
      };
    }),
    spectators: toSummaries(game.spectatorIds, playersById),
    bannedPlayers: toSummaries([...game.bannedIds], playersById),
    territories: [...game.territoryOwners.entries()].map(([id, ownerId]) => ({
      id,
      ownerId,
      troops: game.territoryTroops.get(id) ?? 0,
      isCapital: game.capitalTerritoryIds.has(id),
    })),
  };
}
