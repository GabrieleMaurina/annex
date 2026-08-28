import express from 'express';
import { createServer } from 'http';
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
  registerReplayHandlers,
  registerTerritoryHandlers,
  registerToxinsHandlers,
  registerTroopHandlers,
  scheduleBotTurnIfNeeded,
} from './game';
import { setBotTurnHook } from './game/logic/store';
import { registerHomeHandlers } from './home';
import { registerMapsHandlers } from './maps';
import { HOME_ROOM, Player } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5000',
  },
});

const playersBySocket = new Map<string, Player>();
const playersByKey = new Map<string, Player>();
const playersById = new Map<number, Player>();

setBotTurnHook(scheduleBotTurnIfNeeded);

io.on('connection', (socket) => {
  socket.join(HOME_ROOM);
  registerMapsHandlers(socket);
  registerHomeHandlers(io, socket, playersBySocket, playersByKey, playersById);
  registerGameHandlers(io, socket, playersBySocket, playersById);
  registerBotLobbyHandlers(io, socket, playersBySocket, playersById);
  registerTerritoryHandlers(io, socket, playersBySocket, playersById);
  registerTroopHandlers(io, socket, playersBySocket, playersById);
  registerCapitalHandlers(io, socket, playersBySocket, playersById);
  registerDeployHandlers(io, socket, playersBySocket, playersById);
  registerEmojiHandlers(io, socket, playersBySocket, playersById);
  registerFortifyHandlers(io, socket, playersBySocket, playersById);
  registerEntrenchHandlers(io, socket, playersBySocket, playersById);
  registerToxinsHandlers(io, socket, playersBySocket, playersById);
  registerAttackHandlers(io, socket, playersBySocket, playersById);
  registerCardHandlers(io, socket, playersBySocket, playersById);
  registerAllianceHandlers(io, socket, playersBySocket, playersById);
  registerReplayHandlers(io, socket, playersBySocket);
});

const port = 3000;
httpServer.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
