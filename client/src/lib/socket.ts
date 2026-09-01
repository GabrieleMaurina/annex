import { io, Socket } from 'socket.io-client';
import { attachInbound } from '../connector/inbound';

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function isSocketConnected(): boolean {
  return !!socket?.connected;
}

export function openSocket(gameName: string): Socket {
  if (socket) return socket;
  socket = io(URL, {
    withCredentials: true,
    query: { game: gameName },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  attachInbound(socket);
  return socket;
}

export function closeSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
