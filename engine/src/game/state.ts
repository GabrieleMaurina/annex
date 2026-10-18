import { getGameMap } from '../maps/maps';
import { playersById } from '../session/players';
import { AllianceViewState, Game, Player } from '../types';
import { anonymousName, isAnonymous, isAnonymousPlaying } from './anonymous';
import { attackFullPath } from './combat/seaBridge';
import { supremacyTerritoriesToWin } from './mechanics';
import { nextSetBaseValues, upcomingSetValues } from './progression/cards';
import { emptyPlayerStats } from './progression/stats';
import { fortifyFullPath, sailFullPath } from './world/connectivity';
import { TERRITORY_CAP, totalTroopsCap } from './world/starvation';

function seaState(game: Game) {
  return getGameMap(game).seaTerritories.map((sea) => ({
    id: sea.id,
    ships: [...(game.seaShips.get(sea.id) ?? new Map())].map(
      ([playerId, ships]) => ({ playerId, ships }),
    ),
  }));
}

const EMPTY_STATS = emptyPlayerStats();

function toSummaries(game: Game, ids: number[]) {
  return ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => !!player)
    .map((player) => {
      const hidden =
        isAnonymous(game) && (!player.isBot || isAnonymousPlaying(game));
      return {
        id: player.id,
        name: hidden ? anonymousName(game, player.id) : player.name,
        country: hidden ? null : player.country,
        elo: game.state === 'ended' ? player.elo : null,
      };
    });
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

export function isClaimPhase(game: Game): boolean {
  return (
    game.turnPhase === 'territory' ||
    (game.turnPhase === 'capital' && game.placement === 'single')
  );
}

export function isEliminated(game: Game, territoryCount: number): boolean {
  return game.state !== 'lobby' && !isClaimPhase(game) && territoryCount === 0;
}

export function gameSummary(game: Game) {
  return {
    name: game.name,
    mapName: game.mapName,
    mapGeneration: game.generatedMap
      ? {
          size: game.generatedMap.size,
          type: game.generatedMap.type,
          fill: game.generatedMap.fill,
          tile: game.generatedMap.tile,
          seas: game.generatedMap.seas,
          timed: game.generatedMap.timed,
        }
      : null,
    hostName: isAnonymousPlaying(game)
      ? 'Anonymous'
      : isAnonymous(game)
        ? anonymousName(game, game.hostId)
        : (playersById.get(game.hostId)?.name ?? ''),
    playerIds: isAnonymous(game) ? [] : [...game.playerIds],
    bannedIds: [...game.bannedIds],
    playerCount: game.playerIds.length,
    hasBots: game.playerIds.some((id) =>
      isAnonymousPlaying(game) ? id < 0 : (playersById.get(id)?.isBot ?? false),
    ),
    slots: game.slots,
    state: game.state,
    spectatorCount: game.spectatorIds.length,
    createdAt: game.createdAt,
    roundNumber: game.roundNumber,
    settings: {
      gameMode: game.gameMode,
      blitz: game.blitz,
      defenceDice: game.defenceDice,
      attackDice: game.attackDice,
      diceTies: game.diceTies,
      continents: game.continents,
      initialTroops: game.initialTroops,
      minTroops: game.minTroops,
      troopsPerTerritory: game.troopsPerTerritory,
      maxPoints: game.maxPoints,
      hills: game.hills,
      cards: game.cards,
      placement: game.placement,
      fortification: game.fortification,
      entrenchments: game.entrenchments,
      toxins: game.toxins,
      portals: game.portals,
      radiations: game.radiations,
      nukes: game.nukes,
      starvation: game.starvation,
      roundTroops: game.roundTroops,
      bounties: game.bounties,
      supplyLines: game.supplyLines,
      fogOfWar: game.fogOfWar,
      alliances: game.alliances,
      anonymous: game.anonymous,
      turnDuration: game.turnDuration,
      attackIncrement: game.attackIncrement,
      disconnectBotDifficulty: game.disconnectBotDifficulty,
      disconnectBotPersonality: game.disconnectBotPersonality,
    },
  };
}

export type GameSummary = ReturnType<typeof gameSummary>;

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

function attackPathAsRun(game: Game): number[][] {
  if (
    game.attackStartTerritoryId === null ||
    game.attackEndTerritoryId === null
  )
    return [];
  const turnPlayerId = game.playerIds[game.turnPlayerIndex];
  const path = attackFullPath(
    game,
    turnPlayerId,
    game.attackStartTerritoryId,
    game.attackEndTerritoryId,
  );
  return path.length > 1 ? [path] : [];
}

function sailPathAsRun(game: Game): number[][] {
  if (game.sailStartTerritoryId === null || game.sailEndTerritoryId === null)
    return [];
  const path = sailFullPath(
    game,
    game.sailStartTerritoryId,
    game.sailEndTerritoryId,
  );
  return path.length > 1 ? [path] : [];
}

export function gameState(game: Game) {
  const stats = territoryStats(game);
  const turnPlayerId = game.playerIds[game.turnPlayerIndex];
  const territoriesToWin = supremacyTerritoriesToWin(game);
  const anonymousPlaying = isAnonymousPlaying(game);
  return {
    name: game.name,
    mapName: game.mapName,
    mapGeneration: game.generatedMap
      ? {
          seed: game.generatedMap.seed,
          size: game.generatedMap.size,
          type: game.generatedMap.type,
          fill: game.generatedMap.fill,
          tile: game.generatedMap.tile,
          seas: game.generatedMap.seas,
          timed: game.generatedMap.timed,
        }
      : null,
    playerMapId: game.playerMap?.id ?? null,
    slots: game.slots,
    hostId: game.hostId,
    originalHostId: anonymousPlaying ? 0 : game.originalHostId,
    state: game.state,
    alliances: game.alliances,
    allianceStates: [] as {
      playerId: number;
      state: AllianceViewState;
      cooldownUntil?: number;
    }[],
    anonymous: game.anonymous,
    blitz: game.blitz,
    bounties: game.bounties,
    cards: game.cards,
    continents: game.continents,
    defenceDice: game.defenceDice,
    attackDice: game.attackDice,
    diceTies: game.diceTies,
    disconnectBotDifficulty: game.disconnectBotDifficulty,
    disconnectBotPersonality: game.disconnectBotPersonality,
    entrenchments: game.entrenchments,
    fogOfWar: game.fogOfWar,
    fortification: game.fortification,
    gameMode: game.gameMode,
    initialTroops: game.initialTroops,
    minTroops: game.minTroops,
    troopsPerTerritory: game.troopsPerTerritory,
    maxPoints: game.maxPoints,
    hills: game.hills,
    hillTerritoryIds: game.hillTerritoryIds,
    continentId: game.continentId,
    placement: game.placement,
    portals: game.portals,
    portalTerritoryIds: game.portalTerritoryIds,
    portalsEnabled: game.portalsEnabled,
    radiations: game.radiations,
    radiationTerritoryIds: [...game.radiationTerritoryIds],
    radiationUpcomingTerritoryIds: [...game.radiationUpcomingTerritoryIds],
    nukes: game.nukes,
    arsenal: { nukes: 0, antiNukes: 0 } as { nukes: number; antiNukes: number },
    nukeProjects: [] as {
      kind: 'nuke' | 'antiNuke';
      installmentsPaid: number;
      lastPaidRound: number;
    }[],
    antiNukeTerritoryIds: [] as number[],
    starvation: game.starvation,
    supplyLines: game.supplyLines,
    toxins: game.toxins,
    turnDuration: game.turnDuration,
    attackIncrement: game.attackIncrement,
    roundTroops: game.roundTroops,
    territoryTroopsCap: TERRITORY_CAP,
    totalTroopsCap: totalTroopsCap(game),
    leaderTerritoryCount:
      territoriesToWin === null
        ? null
        : Math.max(
            0,
            ...game.playerIds
              .filter((id) => !game.surrenderedIds.has(id))
              .map((id) => stats.get(id)?.territoryCount ?? 0),
          ),
    territoriesToWin,
    roundNumber: game.roundNumber,
    turnPlayerIndex: game.turnPlayerIndex,
    turnPhase: game.turnPhase,
    troopsToDeploy: game.troopsToDeploy,
    turnStartedAt:
      game.paused && game.pausedAt !== null
        ? game.turnStartedAt + (Date.now() - game.pausedAt)
        : game.turnStartedAt,
    turnExtension: game.turnExtension,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    paused: game.paused,
    pauseUsed: game.pauseUsed,
    pausedAt: game.offline ? null : game.pausedAt,
    botSpeed: game.botSpeed,
    selectedTerritoryId: game.selectedTerritoryId,
    fortifyStartTerritoryId: game.fortifyStartTerritoryId,
    fortifyEndTerritoryId: game.fortifyEndTerritoryId,
    attackStartTerritoryId: game.attackStartTerritoryId,
    attackEndTerritoryId: game.attackEndTerritoryId,
    attackConquestMinTroops: game.attackConquestMinTroops,
    fortifyPathTerritoryIds: fortifyPathAsRun(game),
    attackPathTerritoryIds: attackPathAsRun(game),
    sailStartTerritoryId: game.sailStartTerritoryId,
    sailEndTerritoryId: game.sailEndTerritoryId,
    sailPathTerritoryIds: sailPathAsRun(game),
    attackSeaTerritoryId: game.attackSeaTerritoryId,
    attackSeaDefenderId: game.attackSeaDefenderId,
    winnerIds: game.winnerIds,
    earlyWin: game.earlyWin,
    nextSetBaseValues: nextSetBaseValues(game, turnPlayerId),
    upcomingSetValues: upcomingSetValues(game, turnPlayerId, 3),
    finalRanking: game.finalRanking,
    players: toSummaries(game, game.playerIds).map((player) => {
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
        points: game.points.get(player.id) ?? 0,
        troopsRemaining:
          game.turnPhase === 'troop'
            ? (game.placementTroopPools.get(player.id) ?? 0)
            : 0,
        cardCount: game.playerCards.get(player.id)?.length ?? 0,
        connected:
          anonymousPlaying ||
          (!!member?.connected && member.gameName === game.name),
        surrendered: game.surrenderedIds.has(player.id),
        eliminated: isEliminated(game, territoryCount),
        playersKilled: playerStats.playersKilled as number[] | null,
        troopsKilled: playerStats.troopsKilled as number | null,
        troopsLost: playerStats.troopsLost as number | null,
        isBot: !!member?.isBot && !anonymousPlaying,
        botDifficulty:
          member?.botProfile && !anonymousPlaying
            ? member.botProfile.difficultyHidden
              ? ('random' as const)
              : member.botProfile.difficulty
            : null,
        botPersonality:
          member?.botProfile && !anonymousPlaying
            ? member.botProfile.personalityHidden
              ? ('random' as const)
              : member.botProfile.personality
            : null,
      };
    }),
    spectators: toSummaries(game, game.spectatorIds),
    bannedPlayers: anonymousPlaying
      ? []
      : toSummaries(game, [...game.bannedIds]),
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
        roundsRemaining: toxin.roundsRemaining,
      }),
    ),
    seas: seaState(game),
    visibleTerritoryIds: undefined as number[] | undefined,
  };
}
