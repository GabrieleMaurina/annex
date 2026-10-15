import {
  createEngine,
  EngineCallbacks,
  EventKey,
  EventPayload,
  viewEvent,
} from 'engine';
import { createServer } from 'http';
import os from 'os';
import { Server } from 'socket.io';
import { randomToken } from './auth/auth';
import {
  isSecureRequest,
  isSessionToken,
  parseCookies,
  serializeSessionCookie,
} from './auth/cookies';
import { connectDb } from './db';
import {
  gameElos,
  gameParticipants,
  handleGameEnded,
  reconcileGameElos,
} from './elo';
import {
  registerAllianceHandlers,
  registerAttackHandlers,
  registerAttackSeaHandlers,
  registerBotLobbyHandlers,
  registerCapitalHandlers,
  registerCardHandlers,
  registerDeployHandlers,
  registerEmojiHandlers,
  registerEntrenchHandlers,
  registerFortifyHandlers,
  registerGameHandlers,
  registerMapGenHandlers,
  registerNukeHandlers,
  registerReplayHandlers,
  registerSailHandlers,
  registerTerritoryHandlers,
  registerToxinsHandlers,
  registerTroopHandlers,
} from './game/handlers';
import { getGameMeta, isGamePublic, reconcileGameMeta } from './gameMeta';
import { persistFinishedGame } from './games';
import { registerHomeHandlers } from './home';
import { createHttpApp } from './http/app';
import { LiveGameRow } from './http/liveGames';
import { gameRoomName } from './sockets/rooms';
import {
  emitTo,
  gameNameByPlayerId,
  playerIdForIdentity,
  setSocketRoom,
  socketIdByPlayerId,
  userIdByPlayerId,
} from './sockets/socketRooms';
import { nodeWorkerPort } from './workers/nodeWorkerPort';

function listVisibleGames(): LiveGameRow[] {
  const summaries = engine.listGameSummaries();
  const names = new Set(summaries.map((game) => game.name));
  reconcileGameMeta(names);
  reconcileGameElos(names);
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

function emptySlots(game: LiveGameRow): number {
  return game.slots - game.playerCount;
}

function randomGame(token: string, userId: string | null): string | null {
  const playerId = playerIdForIdentity(token, userId);
  const currentGame =
    playerId === undefined ? null : engine.playerGameName(playerId);
  const candidates = listVisibleGames()
    .filter(
      (game) =>
        game.name !== currentGame &&
        game.state === 'lobby' &&
        !game.hasPassword &&
        emptySlots(game) > 0 &&
        (playerId === undefined || !game.bannedIds.includes(playerId)),
    )
    .sort((a, b) => emptySlots(a) - emptySlots(b) || a.createdAt - b.createdAt);
  return candidates[0]?.name ?? null;
}

function resendResults(gameName: string): void {
  for (const [playerId, name] of gameNameByPlayerId) {
    if (name === gameName) engine.requestResults(playerId);
  }
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
  randomGame,
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

function relay<K extends EventKey>(key: K, event: string) {
  return (playerId: number, payload: EventPayload<K>, gameName: string) => {
    const viewed = viewEvent(gameName, playerId, key, payload);
    if (viewed) emitTo(io, playerId, event, viewed);
  };
}

const callbacks: EngineCallbacks = {
  onHomeGames: () => {},
  onGameState: relay('onGameState', 'game:state'),
  onCards: relay('onCards', 'game:cards'),
  onMission: relay('onMission', 'game:mission'),
  onLogs: relay('onLogs', 'game:logs'),
  onResults: (playerId, payload, gameName) => {
    const viewed = viewEvent(gameName, playerId, 'onResults', payload);
    if (!viewed) return;
    const elos = gameElos(gameName);
    const stats = payload.stats.map((s, index) => ({
      ...viewed.stats[index],
      userId: userIdByPlayerId(s.id) ?? null,
      ...elos.get(s.id),
    }));
    emitTo(io, playerId, 'game:results', { stats });
  },
  onGameEnded: (payload) => {
    const participants = gameParticipants(payload.gameName);
    const elos = handleGameEnded(payload);
    persistFinishedGame(engine, payload, participants, elos);
    elos.then(() => resendResults(payload.gameName));
  },
  onCardSetPlayed: relay('onCardSetPlayed', 'game:cardSetPlayed'),
  onKicked: (playerId, payload) => emitTo(io, playerId, 'game:kicked', payload),
  onChatMessage: relay('onChatMessage', 'game:chatMessage'),
  onEmojiSent: relay('onEmojiSent', 'game:emojiSent'),
  onAllianceRequested: relay('onAllianceRequested', 'game:allianceRequested'),
  onAllianceFormed: relay('onAllianceFormed', 'game:allianceFormed'),
  onAllianceDeclined: relay('onAllianceDeclined', 'game:allianceDeclined'),
  onAllianceTerminated: relay(
    'onAllianceTerminated',
    'game:allianceTerminated',
  ),
  onCapitalPlacementStarted: (playerId) =>
    emitTo(io, playerId, 'game:capitalPlacementStarted'),
  onTerritoryClaimed: relay('onTerritoryClaimed', 'game:territoryClaimed'),
  onTurnStarted: relay('onTurnStarted', 'game:turnStarted'),
  onDeployed: relay('onDeployed', 'game:deployed'),
  onDeployedMany: relay('onDeployedMany', 'game:deployedMany'),
  onFortified: relay('onFortified', 'game:fortified'),
  onShipsBought: relay('onShipsBought', 'game:shipsBought'),
  onSailed: relay('onSailed', 'game:sailed'),
  onSeaAttacked: relay('onSeaAttacked', 'game:seaAttacked'),
  onEntrenched: relay('onEntrenched', 'game:entrenched'),
  onToxined: relay('onToxined', 'game:toxined'),
  onToxinExpired: relay('onToxinExpired', 'game:toxinExpired'),
  onRadiationUpcoming: relay('onRadiationUpcoming', 'game:radiationUpcoming'),
  onRadiationChanged: relay('onRadiationChanged', 'game:radiationChanged'),
  onStarved: relay('onStarved', 'game:starved'),
  onNukeLaunched: relay('onNukeLaunched', 'game:nukeLaunched'),
  onAttacked: relay('onAttacked', 'game:attacked'),
  onTankFired: relay('onTankFired', 'game:tankFired'),
  onAttackMoved: relay('onAttackMoved', 'game:attackMoved'),
  onSelected: relay('onSelected', 'game:selected'),
  onMapGenerated: relay('onMapGenerated', 'game:mapGenerated'),
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

io.on('connection', (socket) => {
  const game = socket.handshake.query.game;
  if (typeof game === 'string' && game) socket.join(gameRoomName(game));
  registerHomeHandlers(io, socket, engine);
  registerGameHandlers(io, socket, engine);
  registerMapGenHandlers(socket, engine);
  registerBotLobbyHandlers(socket, engine);
  registerTerritoryHandlers(socket, engine);
  registerTroopHandlers(socket, engine);
  registerCapitalHandlers(socket, engine);
  registerDeployHandlers(socket, engine);
  registerEmojiHandlers(socket, engine);
  registerSailHandlers(socket, engine);
  registerFortifyHandlers(socket, engine);
  registerEntrenchHandlers(socket, engine);
  registerToxinsHandlers(socket, engine);
  registerNukeHandlers(socket, engine);
  registerAttackHandlers(socket, engine);
  registerAttackSeaHandlers(socket, engine);
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
