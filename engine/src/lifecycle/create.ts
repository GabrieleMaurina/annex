import { assignRandomColor } from '../game/mechanics';
import { defaultMapName } from '../maps/maps';
import { GameResponse } from '../session/context';
import { playersById } from '../session/players';
import { broadcastHomeGames, games, respondGameState } from '../session/store';
import { Game, HOME_ROOM } from '../types';

const MAX_GAME_NAME_LENGTH = 20;

export function validateGameName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_GAME_NAME_LENGTH ||
    trimmed === HOME_ROOM
  )
    return null;
  return trimmed;
}

export function createGame(
  playerId: number,
  settings: { name?: unknown },
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
    mapName: defaultMapName(),
    generatedMap: null,
    slots: 2,
    hostId: player.id,
    originalHostId: player.id,
    state: 'lobby',
    alliances: 'off',
    allianceIds: new Set(),
    allianceRequests: new Map(),
    allianceCooldowns: new Map(),
    allianceInitiators: new Map(),
    blitz: 'Balanced',
    bounties: 'off',
    cards: 'Constant',
    defenceDice: 2,
    disconnectBotDifficulty: 'random',
    disconnectBotPersonality: 'random',
    entrenchments: 'off',
    fogOfWar: 'off',
    fortification: 'Connected',
    gameMode: 'Supremacy',
    continentId: null,
    password: null,
    placement: 'Random',
    portals: 'off',
    portalTerritoryIds: [],
    portalsEnabled: false,
    radiations: 'off',
    radiationTerritoryIds: new Set(),
    radiationUpcomingTerritoryIds: new Set(),
    starvation: 'off',
    supplyLines: 'off',
    toxins: 'off',
    turnDuration: 120,
    turnTroops: 'off',
    visibility: 'public',
    turnNumber: 0,
    turnPlayerIndex: 0,
    turnPhase: 'deploy',
    troopsToDeploy: 0,
    remainingSpecialPhases: [],
    placementTroopPools: new Map(),
    turnStartedAt: 0,
    paused: false,
    pausedAt: null,
    selectedTerritoryId: null,
    fortifyStartTerritoryId: null,
    fortifyEndTerritoryId: null,
    attackStartTerritoryId: null,
    attackEndTerritoryId: null,
    attackConquestMinTroops: null,
    playerIds: [player.id],
    spectatorIds: [],
    playerTeams: new Map([[player.id, 0]]),
    playerColors: new Map(),
    bannedIds: new Set(),
    passwordExemptIds: new Set([player.id]),
    territoryOwners: new Map(),
    territoryTroops: new Map(),
    territoryEntrenchment: new Map(),
    territoryToxins: new Map(),
    capitalTerritoryIds: new Set(),
    playerMissions: new Map(),
    hostPriority: [player.id],
    substituteFor: new Map(),
    lobbyDeparted: new Map(),
    surrenderedIds: new Set(),
    winnerIds: [],
    deck: [],
    playerCards: new Map(),
    conqueredThisTurn: false,
    deployCardMandate: false,
    cardSetsPlayed: new Map(),
    cardsLastSetValue: new Map(),
    stats: new Map(),
    deathOrder: [],
    teamDeathOrder: [],
    finalRanking: [],
    replayInitial: [],
    replayInitialRadiation: [],
    replayFrames: [],
    logs: new Map(),
  };
  games.set(game.name, game);
  player.gameName = game.name;
  assignRandomColor(game, player.id);

  broadcastHomeGames();
  return respondGameState(game, player.id);
}
