import { AllianceViewState, Game, Player } from '../../types';
import { nextSetBaseValues, upcomingSetValues } from './progression/cards';
import { emptyPlayerStats } from './progression/stats';
import { fortifyFullPath } from './world/connectivity';
import { TERRITORY_CAP, totalTroopsCap } from './world/starvation';

const EMPTY_STATS = emptyPlayerStats();

function toSummaries(ids: number[], playersById: Map<number, Player>) {
  return ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => !!player)
    .map((player) => ({ id: player.id, name: player.name }));
}

export function territoryStats(game: Game) {
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

export function isEliminated(game: Game, territoryCount: number): boolean {
  return (
    game.state !== 'lobby' &&
    game.turnPhase !== 'territory' &&
    territoryCount === 0
  );
}

export function gameSummary(game: Game, playersById: Map<number, Player>) {
  return {
    name: game.name,
    mapName: game.mapName,
    hostName: playersById.get(game.hostId)?.name ?? '',
    playerCount: game.playerIds.length,
    slots: game.slots,
    state: game.state,
    spectatorCount: game.spectatorIds.length,
    hasPassword: game.password !== null,
  };
}

export function gameResultsStats(game: Game) {
  return game.playerIds.map((id) => {
    const stats = game.stats.get(id) ?? EMPTY_STATS;
    return {
      id,
      troopsGained: stats.troopsGained,
      troopsKilled: stats.troopsKilled,
      troopsLost: stats.troopsLost,
      territoriesConquered: stats.territoriesConquered,
      territoriesLost: stats.territoriesLost,
      capitalsConquered: stats.capitalsConquered,
      capitalsLost: stats.capitalsLost,
      cardsGained: stats.cardsGained,
      turnsPlayed: stats.turnsPlayed,
      setsPlayed: stats.setsPlayed,
    };
  });
}

function fortifyPathAsRun(game: Game): number[][] {
  if (
    game.fortifyStartTerritoryId === null ||
    game.fortifyEndTerritoryId === null
  )
    return [];
  const turnPlayerId = game.playerIds[game.turnPlayerIndex];
  const path = fortifyFullPath(
    game,
    turnPlayerId,
    game.fortifyStartTerritoryId,
    game.fortifyEndTerritoryId,
  );
  return path.length > 1 ? [path] : [];
}

export function gameState(game: Game, playersById: Map<number, Player>) {
  const stats = territoryStats(game);
  const turnPlayerId = game.playerIds[game.turnPlayerIndex];
  return {
    name: game.name,
    mapName: game.mapName,
    slots: game.slots,
    hostId: game.hostId,
    originalHostId: game.originalHostId,
    state: game.state,
    alliances: game.alliances,
    allianceStates: [] as {
      playerId: number;
      state: AllianceViewState;
      cooldownUntil?: number;
    }[],
    blitz: game.blitz,
    bounties: game.bounties,
    cards: game.cards,
    defenceDice: game.defenceDice,
    disconnectBotDifficulty: game.disconnectBotDifficulty,
    disconnectBotPersonality: game.disconnectBotPersonality,
    entrenchments: game.entrenchments,
    fogOfWar: game.fogOfWar,
    fortification: game.fortification,
    gameMode: game.gameMode,
    continentId: game.continentId,
    hasPassword: game.password !== null,
    placement: game.placement,
    portals: game.portals,
    portalTerritoryIds: game.portalTerritoryIds,
    portalsEnabled: game.portalsEnabled,
    radiations: game.radiations,
    radiationTerritoryIds: [...game.radiationTerritoryIds],
    radiationUpcomingTerritoryIds: [...game.radiationUpcomingTerritoryIds],
    starvation: game.starvation,
    supplyLines: game.supplyLines,
    toxins: game.toxins,
    turnDuration: game.turnDuration,
    turnTroops: game.turnTroops,
    visibility: game.visibility,
    territoryTroopsCap: TERRITORY_CAP,
    totalTroopsCap: totalTroopsCap(game),
    turnNumber: game.turnNumber,
    turnPlayerIndex: game.turnPlayerIndex,
    turnPhase: game.turnPhase,
    troopsToDeploy: game.troopsToDeploy,
    turnStartedAt:
      game.paused && game.pausedAt !== null
        ? game.turnStartedAt + (Date.now() - game.pausedAt)
        : game.turnStartedAt,
    paused: game.paused,
    selectedTerritoryId: game.selectedTerritoryId,
    fortifyStartTerritoryId: game.fortifyStartTerritoryId,
    fortifyEndTerritoryId: game.fortifyEndTerritoryId,
    attackStartTerritoryId: game.attackStartTerritoryId,
    attackEndTerritoryId: game.attackEndTerritoryId,
    attackConquestMinTroops: game.attackConquestMinTroops,
    fortifyPathTerritoryIds: fortifyPathAsRun(game),
    winnerIds: game.winnerIds,
    nextSetBaseValues: nextSetBaseValues(game, turnPlayerId),
    upcomingSetValues: upcomingSetValues(game, turnPlayerId, 3),
    finalRanking: game.finalRanking,
    players: toSummaries(game.playerIds, playersById).map((player) => {
      const territoryCount = stats.get(player.id)?.territoryCount ?? 0;
      const playerStats = game.stats.get(player.id) ?? EMPTY_STATS;
      const member = playersById.get(player.id);
      return {
        ...player,
        team: game.playerTeams.get(player.id) ?? 0,
        color: game.playerColors.get(player.id) ?? 0,
        territoryCount: territoryCount as number | null,
        troopCount: (stats.get(player.id)?.troopCount ?? 0) as number | null,
        capitalCount: stats.get(player.id)?.capitalCount ?? 0,
        troopsRemaining:
          game.turnPhase === 'troop'
            ? (game.placementTroopPools.get(player.id) ?? 0)
            : 0,
        cardCount: game.playerCards.get(player.id)?.length ?? 0,
        connected: !!member?.connected && member.gameName === game.name,
        surrendered: game.surrenderedIds.has(player.id),
        eliminated: isEliminated(game, territoryCount),
        playersKilled: playerStats.playersKilled,
        isBot: !!member?.isBot,
        botDifficulty: member?.botProfile?.difficulty ?? null,
        botPersonality: member?.botProfile?.personality ?? null,
      };
    }),
    spectators: toSummaries(game.spectatorIds, playersById),
    bannedPlayers: toSummaries([...game.bannedIds], playersById),
    territories: [...game.territoryOwners.entries()].map(([id, ownerId]) => ({
      id,
      ownerId,
      troops: game.territoryTroops.get(id) ?? 0,
      isCapital: game.capitalTerritoryIds.has(id),
      entrenchedTurns: game.territoryEntrenchment.get(id) ?? 0,
    })),
    toxinTerritories: [...game.territoryToxins.entries()].map(
      ([id, toxin]) => ({
        id,
        permanent: toxin.permanent,
        turnsRemaining: toxin.turnsRemaining,
      }),
    ),
    visibleTerritoryIds: undefined as number[] | undefined,
  };
}
