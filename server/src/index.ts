import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
  },
});

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
});

const port = 3000;
httpServer.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
