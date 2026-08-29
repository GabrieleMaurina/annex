import { BUILTIN_MAP_NAMES, Engine } from 'engine';
import fs from 'fs';
import path from 'path';
import { Socket } from 'socket.io';

const mapsDir = path.resolve(__dirname, '..', '..', 'client', 'public', 'maps');

export function loadMaps(engine: Engine): void {
  const entries = BUILTIN_MAP_NAMES.map((name) => {
    const data = JSON.parse(
      fs.readFileSync(path.join(mapsDir, `${name}.anx`), 'utf-8'),
    );
    return {
      name: data.name,
      territories: data.territories,
      bonuses: data.bonuses,
    };
  });
  engine.loadMaps(entries);
}

export function registerMapsHandlers(socket: Socket, engine: Engine) {
  socket.on('maps:list', (callback: (names: string[]) => void) => {
    if (typeof callback !== 'function') return;
    callback(engine.listMaps());
  });
}
