import { Engine } from 'engine';
import { storeGame } from './db';
import { gameParticipants } from './elo';
import { persistGameMap } from './maps';

interface GameEndedPayload {
  gameName: string;
  roundNumber: number;
}

export function persistFinishedGame(
  engine: Engine,
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
        name: bundle.name,
        mapGeneration: bundle.mapGeneration,
        originalHostId: bundle.originalHostId,
        startedAt: bundle.startedAt,
        endedAt: bundle.endedAt,
        settings: bundle.settings,
        winnerIds: bundle.winnerIds,
        roundNumber: bundle.roundNumber,
        playerCount: bundle.playerCount,
        capitalTerritoryIds: bundle.capitalTerritoryIds,
        results: bundle.results,
        serverLog: bundle.serverLog,
        replay: bundle.replay,
        mapId,
        players: bundle.players.map((player) => {
          const userId = participants.get(player.playerId) ?? null;
          return { ...player, userId, name: userId ? null : player.name };
        }),
      });
    })
    .catch((error) => console.error('failed to store game', error));
}
