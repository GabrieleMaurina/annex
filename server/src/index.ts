import { createEngine, EngineCallbacks } from 'engine';
import express from 'express';
import { createServer } from 'http';
import os from 'os';
import { Server } from 'socket.io';
import {
  registerAllianceHandlers,
  registerAttackHandlers,
  registerBotLobbyHandlers,
  registerCapitalHandlers,
  registerCardHandlers,
  registerDeployHandlers,
  registerEmojiHandlers,
  registerEntrenchHandlers,
  registerFortifyHandlers,
  registerGameHandlers,
  registerMapGenHandlers,
  registerReplayHandlers,
  registerTerritoryHandlers,
  registerToxinsHandlers,
  registerTroopHandlers,
} from './game/handlers';
import { getGameMeta, isGamePublic, reconcileGameMeta } from './gameMeta';
import { registerHomeHandlers } from './home';
import { loadMaps, registerMapsHandlers } from './maps';
import {
  emitTo,
  HOME_ROOM,
  offlineClientPlayerIds,
  setSocketRoom,
} from './socketRooms';
import { nodeWorkerPort } from './workers/nodeWorkerPort';

type HomeGameSummary = { name: string };

let lastReconciled: unknown[] | null = null;

function reconcile(games: unknown[]): void {
  if (games === lastReconciled) return;
  lastReconciled = games;
  reconcileGameMeta(
    new Set((games as HomeGameSummary[]).map((game) => game.name)),
  );
}

function visibleHomeGames(games: unknown[]): unknown[] {
  return (games as HomeGameSummary[])
    .filter((game) => isGamePublic(game.name))
    .map((game) => ({
      ...game,
      hasPassword: getGameMeta(game.name).password !== null,
    }));
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5000',
  },
  maxHttpBufferSize: 8 * 1024 * 1024,
});

const callbacks: EngineCallbacks = {
  onHomeGames: (playerId, games) => {
    reconcile(games);
    if (offlineClientPlayerIds.has(playerId)) return;
    emitTo(io, playerId, 'home:games', visibleHomeGames(games));
  },
  onGameState: (playerId, state) => emitTo(io, playerId, 'game:state', state),
  onCards: (playerId, payload) => emitTo(io, playerId, 'game:cards', payload),
  onMission: (playerId, payload) =>
    emitTo(io, playerId, 'game:mission', payload),
  onLogs: (playerId, payload) => emitTo(io, playerId, 'game:logs', payload),
  onResults: (playerId, payload) =>
    emitTo(io, playerId, 'game:results', payload),
  onCardSetPlayed: (playerId, payload) =>
    emitTo(io, playerId, 'game:cardSetPlayed', payload),
  onKicked: (playerId, payload) => emitTo(io, playerId, 'game:kicked', payload),
  onChatMessage: (playerId, payload) =>
    emitTo(io, playerId, 'game:chatMessage', payload),
  onEmojiSent: (playerId, payload) =>
    emitTo(io, playerId, 'game:emojiSent', payload),
  onAllianceRequested: (playerId, payload) =>
    emitTo(io, playerId, 'game:allianceRequested', payload),
  onAllianceFormed: (playerId, payload) =>
    emitTo(io, playerId, 'game:allianceFormed', payload),
  onAllianceDeclined: (playerId, payload) =>
    emitTo(io, playerId, 'game:allianceDeclined', payload),
  onAllianceTerminated: (playerId, payload) =>
    emitTo(io, playerId, 'game:allianceTerminated', payload),
  onCapitalPlacementStarted: (playerId) =>
    emitTo(io, playerId, 'game:capitalPlacementStarted'),
  onTerritoryClaimed: (playerId, payload) =>
    emitTo(io, playerId, 'game:territoryClaimed', payload),
  onTurnStarted: (playerId, payload) =>
    emitTo(io, playerId, 'game:turnStarted', payload),
  onDeployed: (playerId, payload) =>
    emitTo(io, playerId, 'game:deployed', payload),
  onDeployedMany: (playerId, payload) =>
    emitTo(io, playerId, 'game:deployedMany', payload),
  onFortified: (playerId, payload) =>
    emitTo(io, playerId, 'game:fortified', payload),
  onEntrenched: (playerId, payload) =>
    emitTo(io, playerId, 'game:entrenched', payload),
  onToxined: (playerId, payload) =>
    emitTo(io, playerId, 'game:toxined', payload),
  onToxinExpired: (playerId, payload) =>
    emitTo(io, playerId, 'game:toxinExpired', payload),
  onRadiationUpcoming: (playerId, payload) =>
    emitTo(io, playerId, 'game:radiationUpcoming', payload),
  onRadiationChanged: (playerId, payload) =>
    emitTo(io, playerId, 'game:radiationChanged', payload),
  onStarved: (playerId, payload) =>
    emitTo(io, playerId, 'game:starved', payload),
  onAttacked: (playerId, payload) =>
    emitTo(io, playerId, 'game:attacked', payload),
  onTankFired: (playerId, payload) =>
    emitTo(io, playerId, 'game:tankFired', payload),
  onAttackMoved: (playerId, payload) =>
    emitTo(io, playerId, 'game:attackMoved', payload),
  onSelected: (playerId, payload) =>
    emitTo(io, playerId, 'game:selected', payload),
  onMapGenerated: (playerId, payload) =>
    emitTo(io, playerId, 'game:mapGenerated', payload),
  onRoomChanged: (playerId, gameName) => setSocketRoom(io, playerId, gameName),
};

export const engine = createEngine(callbacks, {
  botWorker: {
    create: () => nodeWorkerPort('botWorker'),
    poolSize: Math.max(1, os.cpus().length - 1),
  },
  mapgenWorker: {
    create: () => nodeWorkerPort('mapgenWorker'),
    poolSize: 2,
  },
});

loadMaps(engine);

io.on('connection', (socket) => {
  socket.join(HOME_ROOM);
  registerMapsHandlers(socket, engine);
  registerHomeHandlers(io, socket, engine);
  registerGameHandlers(io, socket, engine);
  registerMapGenHandlers(socket, engine);
  registerBotLobbyHandlers(socket, engine);
  registerTerritoryHandlers(socket, engine);
  registerTroopHandlers(socket, engine);
  registerCapitalHandlers(socket, engine);
  registerDeployHandlers(socket, engine);
  registerEmojiHandlers(socket, engine);
  registerFortifyHandlers(socket, engine);
  registerEntrenchHandlers(socket, engine);
  registerToxinsHandlers(socket, engine);
  registerAttackHandlers(socket, engine);
  registerCardHandlers(socket, engine);
  registerAllianceHandlers(socket, engine);
  registerReplayHandlers(socket, engine);
});

const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
