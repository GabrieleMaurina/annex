import { Engine } from 'engine';
import { storeGame } from './db';
import { GameElo } from './elo';
import { persistGameMap } from './maps';

interface GameEndedPayload {
  gameName: string;
  roundNumber: number;
}

export function persistFinishedGame(
  engine: Engine,
  payload: GameEndedPayload,
  participants: Map<number, string>,
  elos: Promise<Map<number, GameElo>>,
): void {
  if (payload.roundNumber < 1) return;

  const bundle = engine.exportGame(payload.gameName);
  if (!bundle) return;

  Promise.all([persistGameMap(engine, payload.gameName), elos])
    .then(([mapId, gameElos]) => {
      if (!mapId) return;
      return storeGame({
        name: bundle.name,
        mapGeneration: bundle.mapGeneration,
        playerMapId: bundle.playerMapId,
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
          const elo = gameElos.get(player.playerId);
          return {
            ...player,
            userId,
            name: userId ? null : player.name,
            elo: elo?.elo ?? 0,
            eloDelta: elo?.eloDelta ?? 0,
          };
        }),
      });
    })
    .catch((error) => console.error('failed to store game', error));
}
