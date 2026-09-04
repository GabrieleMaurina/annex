import { Engine } from 'engine';
import { Server } from 'socket.io';
import { storeGame } from './db';
import { gameParticipants } from './elo';
import { persistGameMap } from './maps';
import { gameRoomName } from './rooms';

interface GameEndedPayload {
  gameName: string;
  roundNumber: number;
}

export function persistFinishedGame(
  engine: Engine,
  io: Server,
  payload: GameEndedPayload,
): void {
  if (payload.roundNumber < 1) return;

  const bundle = engine.exportGame(payload.gameName);
  if (!bundle) return;

  const participants = gameParticipants(payload.gameName);
  persistGameMap(engine, payload.gameName)
    .then((mapId) => {
      if (!mapId) return;
      return storeGame({
        ...bundle,
        mapId,
        players: bundle.players.map((player) => ({
          ...player,
          userId: participants.get(player.playerId) ?? null,
        })),
      }).then((gameId) => {
        io.to(gameRoomName(payload.gameName)).emit('game:stored', { gameId });
      });
    })
    .catch((error) => console.error('failed to store game', error));
}
