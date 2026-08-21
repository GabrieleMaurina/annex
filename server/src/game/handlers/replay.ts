import { Server, Socket } from 'socket.io';
import { Player, ReplayFrame, ReplayTerritory } from '../../types';
import { games } from '../logic/store';

type ReplayResponse =
  | { ok: true; initial: ReplayTerritory[]; frames: ReplayFrame[] }
  | { ok: false; error: string };

export function registerReplayHandlers(
  io: Server,
  socket: Socket,
  playersBySocket: Map<string, Player>,
) {
  socket.on('game:replay', (callback: (response: ReplayResponse) => void) => {
    if (typeof callback !== 'function') return;
    const player = playersBySocket.get(socket.id);
    if (!player || !player.gameName)
      return callback({ ok: false, error: 'not in a game' });

    const game = games.get(player.gameName);
    if (!game) return callback({ ok: false, error: 'game not found' });
    if (game.state !== 'ended')
      return callback({ ok: false, error: 'game not ended' });

    callback({
      ok: true,
      initial: game.replayInitial,
      frames: game.replayFrames,
    });
  });
}
