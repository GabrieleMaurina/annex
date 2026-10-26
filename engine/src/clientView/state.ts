import { gameState } from '../game/state';
import { Game } from '../types';
import { aliasesOf, aliasOf } from './aliases';
import { complete } from './complete';

type GameStateView = ReturnType<typeof gameState>;
type ClientGameState = GameStateView & { selfId?: number };
type PlayerView = GameStateView['players'][number];
type SummaryView = GameStateView['spectators'][number];

function viewPlayer(game: Game, p: PlayerView): PlayerView {
  return complete<PlayerView>({
    id: aliasOf(game, p.id),
    name: p.name,
    country: p.country,
    elo: p.elo,
    team: p.team,
    color: p.color,
    territoryCount: p.territoryCount,
    troopCount: p.troopCount,
    capitalCount: p.capitalCount,
    points: p.points,
    troopsRemaining: p.troopsRemaining,
    cardCount: p.cardCount,
    connected: p.connected,
    surrendered: p.surrendered,
    eliminated: p.eliminated,
    playersKilled:
      p.playersKilled === null ? null : aliasesOf(game, p.playersKilled),
    troopsKilled: p.troopsKilled,
    troopsLost: p.troopsLost,
    isBot: p.isBot,
    botDifficulty: p.botDifficulty,
    botPersonality: p.botPersonality,
  });
}

function viewSummary(game: Game, s: SummaryView): SummaryView {
  return complete<SummaryView>({
    id: aliasOf(game, s.id),
    name: s.name,
    country: s.country,
    elo: s.elo,
  });
}

export function viewGameStateFor(
  game: Game,
  viewerId: number,
  s: GameStateView,
): ClientGameState {
  return complete<ClientGameState>({
    selfId: aliasOf(game, viewerId),
    name: s.name,
    mapName: s.mapName,
    mapGeneration: s.mapGeneration,
    playerMapId: s.playerMapId,
    slots: s.slots,
    hostId: aliasOf(game, s.hostId),
    originalHostId: aliasOf(game, s.originalHostId),
    state: s.state,
    alliances: s.alliances,
    allianceStates: s.allianceStates.map((a) =>
      complete<GameStateView['allianceStates'][number]>({
        playerId: aliasOf(game, a.playerId),
        state: a.state,
        cooldownUntil: a.cooldownUntil,
      }),
    ),
    anonymous: s.anonymous,
    blitz: s.blitz,
    bounties: s.bounties,
    capitalRefund: s.capitalRefund,
    cards: s.cards,
    continents: s.continents,
    defenceDice: s.defenceDice,
    attackDice: s.attackDice,
    diceTies: s.diceTies,
    disconnectBotDifficulty: s.disconnectBotDifficulty,
    disconnectBotPersonality: s.disconnectBotPersonality,
    entrenchments: s.entrenchments,
    fogOfWar: s.fogOfWar,
    fortification: s.fortification,
    gameMode: s.gameMode,
    initialTroops: s.initialTroops,
    minTroops: s.minTroops,
    troopsPerTerritory: s.troopsPerTerritory,
    maxPoints: s.maxPoints,
    hills: s.hills,
    minRank: s.minRank,
    minGames: s.minGames,
    minAccountAge: s.minAccountAge,
    hillTerritoryIds: s.hillTerritoryIds,
    continentId: s.continentId,
    placement: s.placement,
    portals: s.portals,
    portalTerritoryIds: s.portalTerritoryIds,
    portalsEnabled: s.portalsEnabled,
    radiations: s.radiations,
    radiationTerritoryIds: s.radiationTerritoryIds,
    radiationUpcomingTerritoryIds: s.radiationUpcomingTerritoryIds,
    nukes: s.nukes,
    arsenal: s.arsenal,
    nukeProjects: s.nukeProjects,
    antiNukeTerritoryIds: s.antiNukeTerritoryIds,
    starvation: s.starvation,
    supplyLines: s.supplyLines,
    toxins: s.toxins,
    turnDuration: s.turnDuration,
    attackIncrement: s.attackIncrement,
    roundTroops: s.roundTroops,
    territoryTroopsCap: s.territoryTroopsCap,
    totalTroopsCap: s.totalTroopsCap,
    leaderTerritoryCount: s.leaderTerritoryCount,
    territoriesToWin: s.territoriesToWin,
    roundNumber: s.roundNumber,
    turnPlayerIndex: s.turnPlayerIndex,
    turnPhase: s.turnPhase,
    troopsToDeploy: s.troopsToDeploy,
    turnStartedAt: s.turnStartedAt,
    turnExtension: s.turnExtension,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    paused: s.paused,
    pauseUsed: s.pauseUsed,
    pausedAt: s.pausedAt,
    botSpeed: s.botSpeed,
    selectedTerritoryId: s.selectedTerritoryId,
    fortifyStartTerritoryId: s.fortifyStartTerritoryId,
    fortifyEndTerritoryId: s.fortifyEndTerritoryId,
    attackStartTerritoryId: s.attackStartTerritoryId,
    attackEndTerritoryId: s.attackEndTerritoryId,
    attackConquestMinTroops: s.attackConquestMinTroops,
    fortifyPathTerritoryIds: s.fortifyPathTerritoryIds,
    attackPathTerritoryIds: s.attackPathTerritoryIds,
    sailStartTerritoryId: s.sailStartTerritoryId,
    sailEndTerritoryId: s.sailEndTerritoryId,
    sailPathTerritoryIds: s.sailPathTerritoryIds,
    attackSeaTerritoryId: s.attackSeaTerritoryId,
    attackSeaDefenderId:
      s.attackSeaDefenderId === null
        ? null
        : aliasOf(game, s.attackSeaDefenderId),
    winnerIds: aliasesOf(game, s.winnerIds),
    earlyWin: s.earlyWin,
    nextSetBaseValues: s.nextSetBaseValues,
    upcomingSetValues: s.upcomingSetValues,
    finalRanking: aliasesOf(game, s.finalRanking),
    players: s.players.map((p) => viewPlayer(game, p)),
    spectators: s.spectators.map((p) => viewSummary(game, p)),
    bannedPlayers: s.bannedPlayers.map((p) => viewSummary(game, p)),
    territories: s.territories.map((t) =>
      complete<GameStateView['territories'][number]>({
        id: t.id,
        ownerId: aliasOf(game, t.ownerId),
        troops: t.troops,
        isCapital: t.isCapital,
        entrenchedTurns: t.entrenchedTurns,
      }),
    ),
    toxinTerritories: s.toxinTerritories,
    seas: s.seas.map((sea) =>
      complete<GameStateView['seas'][number]>({
        id: sea.id,
        ships: sea.ships.map((ship) =>
          complete<GameStateView['seas'][number]['ships'][number]>({
            playerId: aliasOf(game, ship.playerId),
            ships: ship.ships,
          }),
        ),
      }),
    ),
    unlockedTileIds: s.unlockedTileIds,
    visibleTerritoryIds: s.visibleTerritoryIds,
  });
}
