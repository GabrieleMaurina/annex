import { DEFAULT_SIDES } from '../game/combat/dice';
import { assignRandomColor } from '../game/mechanics';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import { broadcastHomeGames, games, respondGameState } from '../session/store';
import { Game, HOME_ROOM, OFFLINE_ROOM } from '../types';
import {
  DEFAULT_MIN_REPUTATION,
  joinReputation,
  MIN_REPUTATION,
} from './eligibility';

const MAX_GAME_NAME_LENGTH = 20;

export function validateGameName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_GAME_NAME_LENGTH ||
    trimmed === HOME_ROOM ||
    trimmed === OFFLINE_ROOM
  )
    return null;
  return trimmed;
}

export function freshGameRun() {
  return {
    state: 'lobby' as const,
    startedAt: null,
    endedAt: null,
    allianceIds: new Set<string>(),
    allianceRequests: new Map(),
    allianceCooldowns: new Map(),
    allianceInitiators: new Map(),
    aliases: new Map(),
    continentBonuses: [],
    continentPayouts: [],
    hillTerritoryIds: [],
    points: new Map(),
    continentId: null,
    portalTerritoryIds: [],
    portalsEnabled: false,
    radiationTerritoryIds: new Set<number>(),
    radiationUpcomingTerritoryIds: new Set<number>(),
    nukeProjects: new Map(),
    arsenal: new Map(),
    antiNukeTerritoryIds: new Set<number>(),
    drawVoteIds: new Set<number>(),
    abortVoteIds: new Set<number>(),
    draw: null,
    capitalOwnersKey: null,
    capitalStandoffStart: null,
    roundNumber: 0,
    turnPlayerIndex: 0,
    turnPhase: 'deploy' as const,
    troopsToDeploy: 0,
    remainingSpecialPhases: [],
    placementTroopPools: new Map(),
    turnStartedAt: 0,
    turnExtension: 0,
    paused: false,
    pausedAt: null,
    pausedMs: 0,
    pauseUsed: false,
    humansAbandonedAt: null,
    earlyWin: false,
    selectedTerritoryId: null,
    fortifyStartTerritoryId: null,
    fortifyEndTerritoryId: null,
    attackStartTerritoryId: null,
    attackEndTerritoryId: null,
    attackConquestMinTroops: null,
    sailStartTerritoryId: null,
    sailEndTerritoryId: null,
    attackSeaTerritoryId: null,
    attackSeaDefenderId: null,
    seaShips: new Map(),
    territoryOwners: new Map(),
    territoryTroops: new Map(),
    territoryEntrenchment: new Map(),
    fogMemory: new Map(),
    territoryToxins: new Map(),
    unlockedTileIds: new Set<number>(),
    flippedSwitchIds: new Set<number>(),
    capitalTerritoryIds: new Set<number>(),
    capitalRefunds: new Map(),
    playerMissions: new Map(),
    surrenderedIds: new Set<number>(),
    disconnectedTurns: new Map(),
    surrenderRounds: new Map(),
    autoSurrenderedIds: new Set<number>(),
    eliminatedWhileAwayIds: new Set<number>(),
    winnerIds: [],
    deck: [],
    playerCards: new Map(),
    conqueredThisTurn: false,
    deployCardMandate: false,
    cardSetsPlayed: new Map(),
    cardsLastSetValue: new Map(),
    stats: new Map(),
    frozenKillCount: new Map(),
    deathOrder: [],
    teamDeathOrder: [],
    finalRanking: [],
    replayInitial: [],
    replayInitialRadiation: [],
    replayFrames: [],
    replayTurnMarkers: [],
    replayChat: [],
    replayEmoji: [],
    replayLog: [],
    logs: new Map(),
  };
}

export function createGame(
  playerId: number,
  settings: { name?: unknown },
  offline = false,
): GameResponse {
  const player = playersById.get(playerId);
  if (!player) return { ok: false, error: 'not identified' };
  if (player.gameName) return { ok: false, error: 'already in a game' };

  let name = `Game with ${player.name}`;
  if (settings.name !== undefined) {
    const trimmedName = validateGameName(settings.name);
    if (!trimmedName) return { ok: false, error: 'invalid name' };
    name = trimmedName;
  }

  if (games.has(name)) return { ok: false, error: 'game name already in use' };

  const game: Game = {
    name,
    mapName: '',
    generatedMap: null,
    playerMap: null,
    slots: 2,
    teamSlots: [2],
    hostId: player.id,
    originalHostId: player.id,
    offline,
    tutorial: false,
    createdAt: Date.now(),
    alliances: 'off',
    anonymous: 'off',
    blitz: 'balanced',
    bounties: 'off',
    capitalRefund: 'off',
    startingCapitals: 1,
    cards: 'constant',
    continents: '1x',
    defenceDice: 2,
    attackDice: 3,
    defenceSides: DEFAULT_SIDES,
    attackSides: DEFAULT_SIDES,
    diceTies: 'defence',
    disconnectBotDifficulty: 'random',
    disconnectBotPersonality: 'random',
    entrenchments: 'off',
    fogOfWar: 'off',
    fortification: 'connected',
    gameMode: 'supremacy',
    initialTroops: 3,
    minTroops: 3,
    troopsPerTerritory: 1 / 3,
    maxPoints: 20,
    hills: 3,
    minRank: 'private',
    minGames: 0,
    minAccountAge: 'none',
    minReputation:
      joinReputation(player, Date.now()) < DEFAULT_MIN_REPUTATION
        ? MIN_REPUTATION
        : DEFAULT_MIN_REPUTATION,
    placement: 'random',
    portals: 'off',
    radiations: 'off',
    nukes: 'off',
    starvation: 'off',
    supplyLines: 'off',
    toxins: 'off',
    turnDuration: 120,
    attackIncrement: 0,
    roundTroops: 'off',
    maxRounds: 1000,
    maxDuration: 180,
    capitalStandoff: 50,
    drawOfferRound: 500,
    botSpeed: 'slow',
    playerIds: [player.id],
    spectatorIds: [],
    playerTeams: new Map([[player.id, 0]]),
    playerColors: new Map(),
    bannedIds: new Set(),
    hostPriority: [player.id],
    substituteFor: new Map(),
    lobbyDeparted: new Map(),
    ...freshGameRun(),
  };
  games.set(game.name, game);
  player.gameName = game.name;
  assignRandomColor(game, player.id);

  broadcastHomeGames();
  return respondGameState(game, player.id);
}
