import { scheduleBotTurnIfNeeded } from './bots/controller';
import { EngineCallbacks, setCallbacks } from './callbacks';
import { addPlayer as addEnginePlayer } from './session/players';
import {
  disconnect,
  isGameMember,
  listGameSummaries,
  occupiedGames,
  playerGameName,
  playerGameState,
  resyncPlayer,
  setBadges,
  setBotTurnHook,
  setExperience,
  setName,
  setPreferredColors,
  setReputation,
} from './session/store';
import { setWorkerConfig } from './workers/registry';
import { EngineWorkerConfig } from './workers/types';

import { exportGame } from './game/export';
import {
  addBot,
  cycleBotColor,
  removeBot,
  setBotProfile,
} from './lifecycle/bots';
import { createGame } from './lifecycle/create';
import { joinGame } from './lifecycle/join';
import {
  clearMap,
  generateMap,
  mapSelectionError,
  selectPlayerMap,
} from './lifecycle/mapgen';
import {
  cycleBotSpeed,
  cycleColor,
  endGame,
  mapForGame,
  nextPhase,
  pauseGame,
  previousPhase,
  requestResults,
  requestState,
  surrender,
  toggleAbort,
  toggleDraw,
} from './lifecycle/misc';
import { updateSettings } from './lifecycle/settings';
import { restartGame, startGame } from './lifecycle/start';
import { startTutorial } from './lifecycle/tutorial';

import {
  attack,
  attackMove,
  attackSelectEnd,
  attackSelectStart,
  flipSwitch,
  quickAttack,
  unlockTile,
} from './territory/attack';
import { playCardSet, requestCards } from './territory/cards';
import { deploy, selectTerritory } from './territory/deploy';
import { entrench } from './territory/entrench';
import {
  fortify,
  fortifySelectEnd,
  fortifySelectStart,
  quickFortify,
} from './territory/fortify';
import {
  advanceNuke,
  buildAntiNuke,
  buildNuke,
  deployAntiNukeAction,
  launchNukeAction,
} from './territory/nukes';
import { selectCapital } from './territory/placement/capital';
import { claimTerritory } from './territory/placement/territory';
import { placeTroop } from './territory/placement/troop';
import { requestReplay } from './territory/replay';
import {
  attackSea,
  attackSeaSelectDefender,
  attackSeaSelectStart,
  quickAttackSea,
} from './territory/sea/attackSea';
import { buyShips } from './territory/sea/buyShips';
import {
  quickSail,
  sail,
  sailSelectEnd,
  sailSelectStart,
} from './territory/sea/sail';
import { toxin } from './territory/toxins';

import {
  offerAlliance,
  respondAllianceRequest,
  revokeAllianceRequest,
  terminateAlliance,
} from './social/alliance';
import { sendChat } from './social/chat';
import { sendEmoji } from './social/emoji';

export { runBotWorker } from './bots/planning/worker';
export { EngineCallbacks } from './callbacks';
export { EventKey, EventPayload } from './clientView/events';
export {
  fromClient,
  isActorAnonymous,
  toClient,
  ViewableResponse,
  viewEvent,
  viewReplay,
  viewResponse,
} from './clientView/responses';
export { PLAYER_COLOR_NAMES } from './game/anonymous';
export {
  DEFAULT_SIDES,
  MAX_DICE,
  MAX_SIDES,
  MIN_SIDES,
} from './game/combat/dice';
export {
  buildGameDataExport,
  GameDataSource,
} from './game/dataExport/gameData';
export {
  GameExport,
  GameResultExport,
  ReplayEntry,
  ReplayTerritoryDelta,
} from './game/export';
export {
  COLOR_COUNT,
  deployableTroops,
  MAX_TERRITORY_TROOPS,
  nextFreeColor,
} from './game/mechanics';
export {
  ANTI_NUKE_INSTALLMENT,
  NUKE_INSTALLMENT,
  NUKE_INSTALLMENTS,
} from './game/nukes/nukes';
export {
  defaultMaxPoints,
  isPointsMode,
  MAX_HILLS,
  MAX_POINTS_VALUES,
  MIN_HILLS,
} from './game/progression/points';
export { GameSummary } from './game/state';
export { ONLINE_PAUSE_SECONDS } from './game/turns';
export {
  DAY_MS,
  DEFAULT_MIN_REPUTATION,
  effectiveReputation,
  joinReputation,
  MAX_REPUTATION,
  meetsMinAccountAge,
  meetsMinGames,
  meetsMinRank,
  meetsRequirements,
  MIN_ACCOUNT_AGE_VALUES,
  MIN_GAMES_VALUES,
  MIN_RANK_VALUES,
  MIN_REPUTATION,
  MIN_REPUTATION_VALUES,
  newAccountAllowance,
  RANKS,
} from './lifecycle/eligibility';
export {
  isBlitzOffAllowed,
  MAX_BLITZ_OFF_TROOPS,
  MAX_DURATION_VALUES,
  MAX_STALEMATE_ROUNDS,
  MAX_STARTING_CAPITALS,
  MIN_CAPITAL_STANDOFF,
  MIN_STALEMATE_ROUNDS,
  MIN_STARTING_CAPITALS,
} from './lifecycle/settings';
export { TUTORIAL_IDS, TutorialScenario } from './lifecycle/tutorial';
export {
  aspectLabel,
  expectedTerritoryArea,
  Fill,
  FILL_VALUES,
  GENERATION_TYPE_VALUES,
  GenerationType,
  MAP_ASPECT_VALUES,
  MAP_SIZE_VALUES,
  MapAspect,
  mapImageSize,
  MapSize,
  mapSizeLabel,
  TILE_SHAPE_VALUES,
  TileShape,
  tileShapeLabel,
} from './mapgen/core/params';
export { createRng } from './mapgen/core/rng';
export { createWarpField, warpAt } from './mapgen/core/warp';
export { generatedTileGrid } from './mapgen/generate';
export { enforceContiguity } from './mapgen/pipeline/contiguity';
export {
  generateOsmMap,
  osmAreaMask,
  osmPlaceMask,
} from './mapgen/pipeline/osm/osmMap';
export {
  LOCAL_ZOOM as OSM_LOCAL_ZOOM,
  RIVER_LINE_ZOOM as OSM_RIVER_LINE_ZOOM,
} from './mapgen/pipeline/osm/ranks';
export {
  OsmAreaParams,
  OsmDetail,
  OsmElevation,
  OsmFeatures,
  OsmFocus,
  OsmGeneratedMap,
  OsmLine,
  OsmMapParams,
  OsmPlace,
  OsmPlaceParams,
  OsmRiver,
  OsmWater,
} from './mapgen/pipeline/osm/types';
export { tileSide } from './mapgen/pipeline/tile/tileMap';
export { tileVariants } from './mapgen/pipeline/tile/tiling';
export {
  BORDER_THICKNESS,
  continentTileTone,
  DEFAULT_BORDER_COLORS,
  DUNGEON_SEAM_COLOR,
  DUNGEON_TONES,
  DUNGEON_VOID_COLOR,
  DUNGEON_WALL_COLOR,
  EARTH_TONES,
  SEA_COLOR,
  TEMPLE_SEAM_COLOR,
  TEMPLE_TONES,
  TEMPLE_VOID_COLOR,
  TEMPLE_WALL_COLOR,
  TILE_SEA_COLOR,
  TILE_SEAM_COLOR,
  TILE_TONES,
  TILE_VOID_COLOR,
  TILE_WALL_COLOR,
} from './mapgen/render/palette';
export { runMapgenWorker } from './mapgen/worker';
export {
  isStronglyConnected,
  pointsForward,
  roundsUntilFlip,
  withDirectedConnections,
  withEventualLinks,
  withSeaHops,
} from './maps/directionalConnections';
export { withUnlockedTiles } from './maps/lockedTiles';
export { ArchivedMap } from './maps/maps';
export {
  duplicatePlaceNames,
  isValidPlaceName,
  MAX_PLACE_NAME_LENGTH,
} from './maps/placeNames';
export {
  FLIP_COST,
  linkKey,
  MAX_SWITCHES,
  switchedLinkKeys,
  switchedLinkStates,
  switchStates,
} from './maps/switches';
export {
  isConnectionOpen,
  MAX_TIMED_VALUE,
  roundsUntilToggle,
  withOpenConnections,
} from './maps/timedConnections';
export { randomPlayerName } from './session/players';
export { REPORT_REASONS, ReportReason } from './social/reports';
export {
  AchievementFacts,
  DirectionalConnection,
  FixedTile,
  GameMap,
  LockedTile,
  MapSwitch,
  PlayerGameMap,
  SwitchedLink,
  SwitchGate,
  TimedConnection,
} from './types';
export { containsProfanity } from './util/profanity';
export {
  EngineWorkerConfig,
  EngineWorkerFactory,
  EngineWorkerHandle,
  EngineWorkerScope,
  WorkerResult,
} from './workers/types';

export function createEngine(
  callbacks: EngineCallbacks,
  workerConfig: EngineWorkerConfig,
) {
  setCallbacks(callbacks);
  setWorkerConfig(workerConfig);
  setBotTurnHook(scheduleBotTurnIfNeeded);

  return {
    addPlayer(name?: string, country?: string, elo?: number): { id: number } {
      return { id: addEnginePlayer(name, country ?? null, elo ?? null).id };
    },
    resyncPlayer,
    setName,
    setBadges,
    setExperience,
    setReputation,
    setPreferredColors,
    disconnect,
    listGameSummaries,
    playerGameName,
    isGameMember,
    occupiedGames,
    playerGameState,
    mapForGame,

    createGame,
    joinGame,
    requestState,
    requestResults,
    updateSettings,
    startGame,
    restartGame,
    startTutorial,
    cycleColor,
    nextPhase,
    previousPhase,
    pauseGame,
    cycleBotSpeed,
    surrender,
    endGame,
    toggleDraw,
    toggleAbort,
    sendChat,

    generateMap,
    clearMap,
    selectPlayerMap,
    mapSelectionError,

    addBot,
    setBotProfile,
    removeBot,
    cycleBotColor,

    claimTerritory,
    placeTroop,
    selectCapital,
    selectTerritory,
    deploy,
    buyShips,

    requestCards,
    playCardSet,

    sailSelectStart,
    sailSelectEnd,
    sail,
    quickSail,

    fortifySelectStart,
    fortifySelectEnd,
    fortify,
    quickFortify,

    attackSeaSelectStart,
    attackSeaSelectDefender,
    attackSea,
    quickAttackSea,

    entrench,
    toxin,

    buildNuke,
    buildAntiNuke,
    advanceNuke,
    launchNuke: launchNukeAction,
    deployAntiNuke: deployAntiNukeAction,

    attackSelectStart,
    attackSelectEnd,
    attack,
    attackMove,
    quickAttack,
    unlockTile,
    flipSwitch,

    requestReplay,
    exportGame,

    sendEmoji,
    offerAlliance,
    revokeAllianceRequest,
    respondAllianceRequest,
    terminateAlliance,
  };
}

export type Engine = ReturnType<typeof createEngine>;
