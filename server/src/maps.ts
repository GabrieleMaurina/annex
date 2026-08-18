import fs from 'fs';
import path from 'path';
import { Socket } from 'socket.io';
import { GameMap } from './types';

const mapsDir = path.resolve(__dirname, '..', '..', 'client', 'public', 'maps');

export const maps = new Map<string, GameMap>();

for (const file of fs.readdirSync(mapsDir)) {
  if (!file.endsWith('.anx')) continue;
  const data = JSON.parse(fs.readFileSync(path.join(mapsDir, file), 'utf-8'));
  maps.set(data.name, {
    name: data.name,
    territories: data.territories,
    bonuses: data.bonuses,
  });
}

export const defaultMapName = maps.has('World') ? 'World' : [...maps.keys()][0];

export function listMapNames(): string[] {
  return [...maps.keys()];
}

export function registerMapsHandlers(socket: Socket) {
  socket.on('maps:list', (callback: (names: string[]) => void) => {
    if (typeof callback !== 'function') return;
    callback(listMapNames());
  });
}
