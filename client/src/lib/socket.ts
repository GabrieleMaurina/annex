import { io } from 'socket.io-client';

export const socket = io(
  import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',
  {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  },
);
