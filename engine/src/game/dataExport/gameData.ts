import { GameMode } from '../../types';
import { GameExport } from '../export';
import { isPointsMode } from '../progression/points';
import { buildCharts } from './charts';

type SourcePlayer = GameExport['players'][number] & {
  userId?: string | null;
  country?: string | null;
  elo?: number;
  eloDelta?: number;
  eloPenalty?: 'disconnected' | 'surrender' | null;
};

export type GameDataSource = Omit<GameExport, 'players' | 'serverLog'> & {
  id?: string | null;
  players: SourcePlayer[];
};

export function buildGameDataExport(game: GameDataSource) {
  const nameById = new Map(game.players.map((p) => [p.playerId, p.name]));
  const playerById = new Map(game.players.map((p) => [p.playerId, p]));
  const drawnIds = new Set(game.draw?.playerIds ?? []);
  const nameOf = (id: number) => nameById.get(id) ?? '?';

  return {
    kind: 'game',
    exportedAt: new Date().toISOString(),
    game: {
      id: game.id ?? null,
      name: game.name,
      startedAt: new Date(game.startedAt).toISOString(),
      endedAt: new Date(game.endedAt).toISOString(),
      durationMinutes: Math.round((game.endedAt - game.startedAt) / 60000),
      rounds: game.roundNumber,
      playerCount: game.playerCount,
      draw: game.draw?.reason ?? null,
      winners: game.winnerIds.map(nameOf),
    },
    map: { name: game.mapName, ...game.mapGeneration },
    settings: game.settings,
    players: game.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      country: p.country ?? null,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
      botPersonality: p.botPersonality,
      team: p.team,
      color: p.color,
      turnOrder: p.turnOrder,
      host: p.playerId === game.originalHostId,
    })),
    results: [...game.results]
      .sort((a, b) => a.rank - b.rank)
      .map((r) => {
        const player = playerById.get(r.playerId);
        const account = player?.userId ? player : undefined;
        return {
          position: drawnIds.has(r.playerId) ? 1 : r.rank + 1,
          playerId: r.playerId,
          player: nameOf(r.playerId),
          elo: account ? (account.elo ?? 0) + (account.eloDelta ?? 0) : null,
          eloDelta: account ? (account.eloDelta ?? 0) : null,
          eloPenalty: account?.eloPenalty ?? null,
          points: r.points ?? null,
          eliminated: r.eliminated,
          surrendered: r.surrendered,
          turnsPlayed: r.turnsPlayed,
          playersKilled: r.playersKilled.length,
          killed: r.playersKilled.map(nameOf),
          troopsGained: r.troopsGained,
          troopsKilled: r.troopsKilled,
          troopsLost: r.troopsLost,
          territoriesConquered: r.territoriesConquered,
          territoriesLost: r.territoriesLost,
          capitalsConquered: r.capitalsConquered,
          capitalsLost: r.capitalsLost,
          cardsGained: r.cardsGained,
          cardsStolen: r.cardsStolen ?? null,
          setsPlayed: r.setsPlayed,
          setsOnThree: r.setsOnThree ?? null,
          turnsOnThree: r.turnsOnThree ?? null,
          luck: r.luck ?? null,
        };
      }),
    charts: buildCharts(
      game,
      game.settings.gameMode === 'capitals',
      isPointsMode(game.settings.gameMode as GameMode),
    ),
  };
}
