import { scheduleBotTurnIfNeeded } from './bots/controller';
import { EngineCallbacks, setCallbacks } from './callbacks';
import { addPlayer as addEnginePlayer } from './session/players';
import {
  disconnect,
  listGameSummaries,
  playerGameName,
  playerGameState,
  resyncPlayer,
  setBadges,
  setBotTurnHook,
  setExperience,
  setName,
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
  requestResults,
  requestState,
  surrender,
} from './lifecycle/misc';
import { updateSettings } from './lifecycle/settings';
import { startGame } from './lifecycle/start';

import {
  attack,
  attackMove,
  attackSelectEnd,
  attackSelectStart,
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
  ViewableResponse,
  viewEvent,
  viewReplay,
  viewResponse,
} from './clientView/responses';
export { MAX_DICE } from './game/combat/dice';
export {
  GameExport,
  GameResultExport,
  ReplayEntry,
  ReplayTerritoryDelta,
} from './game/export';
export { deployableTroops, MAX_TERRITORY_TROOPS } from './game/mechanics';
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
  meetsMinAccountAge,
  meetsMinGames,
  meetsMinRank,
  meetsRequirements,
  MIN_ACCOUNT_AGE_VALUES,
  MIN_GAMES_VALUES,
  MIN_RANK_VALUES,
  RANKS,
} from './lifecycle/eligibility';
export { isBlitzOffAllowed } from './lifecycle/settings';
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
export { createWarpField, warpAt } from './mapgen/core/warp';
export { enforceContiguity } from './mapgen/pipeline/contiguity';
export { generateOsmMap } from './mapgen/pipeline/osm/osmMap';
export { LOCAL_ZOOM as OSM_LOCAL_ZOOM } from './mapgen/pipeline/osm/ranks';
export {
  OsmDetail,
  OsmFeatures,
  OsmFocus,
  OsmGeneratedMap,
  OsmLine,
  OsmMapParams,
  OsmPlace,
  OsmWater,
} from './mapgen/pipeline/osm/types';
export {
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
export { withUnlockedTiles } from './maps/lockedTiles';
export { ArchivedMap } from './maps/maps';
export {
  duplicatePlaceNames,
  isValidPlaceName,
  MAX_PLACE_NAME_LENGTH,
} from './maps/placeNames';
export {
  isConnectionOpen,
  MAX_TIMED_VALUE,
  roundsUntilToggle,
  withOpenConnections,
} from './maps/timedConnections';
export { randomPlayerName } from './session/players';
export { GameMap, LockedTile, PlayerGameMap, TimedConnection } from './types';
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
    disconnect,
    listGameSummaries,
    playerGameName,
    playerGameState,
    mapForGame,

    createGame,
    joinGame,
    requestState,
    requestResults,
    updateSettings,
    startGame,
    cycleColor,
    nextPhase,
    pauseGame,
    cycleBotSpeed,
    surrender,
    endGame,
    sendChat,

    generateMap,
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
