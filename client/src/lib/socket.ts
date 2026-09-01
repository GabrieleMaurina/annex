import { io } from 'socket.io-client';

export const socket = io(
  import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',
  {
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  },
);

let rebinding = false;

export function rebindSocket(): void {
  rebinding = true;
  socket.disconnect();
  socket.connect();
}

export function isRebindDisconnect(): boolean {
  if (!rebinding) return false;
  rebinding = false;
  return true;
}
