import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { broadcastGameStates, registerGameHandlers } from './game';
import { broadcastHomeGames, registerHomeHandlers } from './home';
import { listMapNames } from './maps';
import { HOME_ROOM, Player } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
  },
});

const playersBySocket = new Map<string, Player>();
const playersByKey = new Map<string, Player>();
const playersById = new Map<number, Player>();

io.on('connection', (socket) => {
  socket.join(HOME_ROOM);
  socket.emit('maps:list', listMapNames());
  registerHomeHandlers(io, socket, playersBySocket, playersByKey, playersById);
  registerGameHandlers(io, socket, playersBySocket, playersById);
});

setInterval(() => {
  broadcastHomeGames(io);
  broadcastGameStates(io, playersById);
}, 1000);

const port = 3000;
httpServer.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
