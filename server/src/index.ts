import { createEngine, EngineCallbacks } from 'engine';
import { createServer } from 'http';
import os from 'os';
import { Server } from 'socket.io';
import { randomToken } from './auth';
import {
  isSecureRequest,
  isSessionToken,
  parseCookies,
  serializeSessionCookie,
} from './cookies';
import { connectDb } from './db';
import { handleGameEnded } from './elo';
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
import { persistFinishedGame } from './games';
import { registerHomeHandlers } from './home';
import { createHttpApp } from './http/app';
import { LiveGameRow } from './http/liveGames';
import { loadMaps, registerMapsHandlers } from './maps';
import { gameRoomName } from './rooms';
import {
  emitTo,
  playerIdForIdentity,
  setSocketRoom,
  socketIdByPlayerId,
  userIdByPlayerId,
} from './socketRooms';
import { nodeWorkerPort } from './workers/nodeWorkerPort';

function listVisibleGames(): LiveGameRow[] {
  const summaries = engine.listGameSummaries();
  reconcileGameMeta(new Set(summaries.map((game) => game.name)));
  return summaries
    .filter((game) => isGamePublic(game.name))
    .map((game) => ({
      ...game,
      hasPassword: getGameMeta(game.name).password !== null,
      playerUserIds: game.playerIds
        .map((id) => userIdByPlayerId(id))
        .filter((id): id is string => id !== undefined),
    }));
}

function playerGame(token: string, userId: string | null): string | null {
  const playerId = playerIdForIdentity(token, userId);
  return playerId === undefined ? null : engine.playerGameName(playerId);
}

function inLiveGame(token: string, userId: string | null): boolean {
  const playerId = playerIdForIdentity(token, userId);
  if (playerId === undefined) return false;
  return (
    socketIdByPlayerId.has(playerId) ||
    engine.playerGameState(playerId) === 'playing'
  );
}

const app = createHttpApp({
  listGames: listVisibleGames,
  playerGame,
  inLiveGame,
});
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5000',
    credentials: true,
  },
  maxHttpBufferSize: 8 * 1024 * 1024,
});

io.engine.on('initial_headers', (headers, req) => {
  const raw = parseCookies(req.headers.cookie).anx;
  const existing = isSessionToken(raw) ? raw : undefined;
  const token = existing || randomToken();
  (req as { anxToken?: string }).anxToken = token;
  if (!existing)
    headers['set-cookie'] = serializeSessionCookie(
      token,
      isSecureRequest(req),
      true,
    );
});

const callbacks: EngineCallbacks = {
  onHomeGames: () => {},
  onGameState: (playerId, state) => emitTo(io, playerId, 'game:state', state),
  onCards: (playerId, payload) => emitTo(io, playerId, 'game:cards', payload),
  onMission: (playerId, payload) =>
    emitTo(io, playerId, 'game:mission', payload),
  onLogs: (playerId, payload) => emitTo(io, playerId, 'game:logs', payload),
  onResults: (playerId, payload) => {
    const stats = (payload.stats as { id: number }[]).map((s) => ({
      ...s,
      userId: userIdByPlayerId(s.id) ?? null,
    }));
    emitTo(io, playerId, 'game:results', { stats });
  },
  onGameEnded: (payload) => {
    persistFinishedGame(engine, payload);
    handleGameEnded(payload);
  },
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
  const game = socket.handshake.query.game;
  if (typeof game === 'string' && game) socket.join(gameRoomName(game));
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

connectDb().catch((error) => {
  console.error(error);
  process.exit(1);
});

const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
