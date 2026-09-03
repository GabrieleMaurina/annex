import { scheduleBotTurnIfNeeded } from './bots/controller';
import { EngineCallbacks, setCallbacks } from './callbacks';
import { loadMaps } from './maps/maps';
import { addPlayer as addEnginePlayer } from './session/players';
import {
  disconnect,
  listGameSummaries,
  playerGameName,
  playerGameState,
  resyncPlayer,
  setBotTurnHook,
  setName,
} from './session/store';
import { setWorkerConfig } from './workers/registry';
import { EngineWorkerConfig } from './workers/types';

import {
  addBot,
  cycleBotColor,
  removeBot,
  setBotProfile,
} from './lifecycle/bots';
import { createGame } from './lifecycle/create';
import { joinGame } from './lifecycle/join';
import { generateMap, listMaps } from './lifecycle/mapgen';
import {
  cycleColor,
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
} from './territory/attack';
import { selectCapital } from './territory/capital';
import { playCardSet, requestCards } from './territory/cards';
import { deploy, selectTerritory } from './territory/deploy';
import { entrench } from './territory/entrench';
import {
  fortify,
  fortifySelectEnd,
  fortifySelectStart,
} from './territory/fortify';
import { requestReplay } from './territory/replay';
import { claimTerritory } from './territory/territory';
import { toxin } from './territory/toxins';
import { placeTroop } from './territory/troop';

import {
  offerAlliance,
  respondAllianceRequest,
  revokeAllianceRequest,
  terminateAlliance,
} from './social/alliance';
import { sendChat } from './social/chat';
import { sendEmoji } from './social/emoji';

import { GameMap } from './types';

export { runBotWorker } from './bots/planning/worker';
export { EngineCallbacks } from './callbacks';
export {
  MAP_SIZE_VALUES,
  MapSize,
  WATER_LEVEL_VALUES,
  WaterLevel,
} from './mapgen/core/params';
export { runMapgenWorker } from './mapgen/worker';
export { ArchivedMap, BUILTIN_MAP_NAMES } from './maps/maps';
export { randomPlayerName } from './session/players';
export { GameMap } from './types';
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
    loadMaps(entries: GameMap[]) {
      loadMaps(entries);
    },

    addPlayer(name?: string): { id: number } {
      return { id: addEnginePlayer(name).id };
    },
    resyncPlayer,
    setName,
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
    surrender,
    sendChat,

    listMaps,
    generateMap,

    addBot,
    setBotProfile,
    removeBot,
    cycleBotColor,

    claimTerritory,
    placeTroop,
    selectCapital,
    selectTerritory,
    deploy,

    requestCards,
    playCardSet,

    fortifySelectStart,
    fortifySelectEnd,
    fortify,

    entrench,
    toxin,

    attackSelectStart,
    attackSelectEnd,
    attack,
    attackMove,

    requestReplay,

    sendEmoji,
    offerAlliance,
    revokeAllianceRequest,
    respondAllianceRequest,
    terminateAlliance,
  };
}

export type Engine = ReturnType<typeof createEngine>;
