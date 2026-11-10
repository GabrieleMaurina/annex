import {
  GameDoc,
  getPlayerHistory,
  getPlayerProfile,
  listPlayerAchievements,
  listPlayerMaps,
  PlayerHistoryPoint,
  resolveNames,
  toRow,
} from '../db';
import { getCollection } from '../db/mongo';

const MAX_MAPS = 10000;

function listAllGames(userId: string) {
  return getCollection<GameDoc>('games')
    .find(
      { 'players.userId': userId },
      {
        projection: { replay: 0, serverLog: 0 },
        sort: { endedAt: -1, _id: -1 },
      },
    )
    .toArray()
    .then((docs) =>
      resolveNames(docs).then(({ mapNameById, nameByUserId }) =>
        docs.map((doc) => {
          const row = toRow(doc, mapNameById, nameByUserId, userId);
          return {
            id: row.id,
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            name: row.name,
            mapName: row.mapName,
            mode: row.gameMode,
            players: row.players.map((p) => p.name),
            winners: row.draw ? [] : row.winnerNames,
            draw: row.draw,
            rounds: row.roundNumber,
            position: row.yourRank === null ? null : row.yourRank + 1,
          };
        }),
      ),
    );
}

function statsOverTime(history: PlayerHistoryPoint[]) {
  const totals = {
    games: 0,
    wins: 0,
    troopsGained: 0,
    troopsKilled: 0,
    troopsLost: 0,
    territoriesConquered: 0,
    playersKilled: 0,
    capitalsConquered: 0,
    setsPlayed: 0,
  };
  return history.map((point) => {
    totals.games += 1;
    totals.wins += point.won ? 1 : 0;
    totals.troopsGained += point.troopsGained;
    totals.troopsKilled += point.troopsKilled;
    totals.troopsLost += point.troopsLost;
    totals.territoriesConquered += point.territoriesConquered;
    totals.playersKilled += point.playersKilled;
    totals.capitalsConquered += point.capitalsConquered;
    totals.setsPlayed += point.setsPlayed;
    return {
      startedAt: new Date(point.startedAt).toISOString(),
      endedAt: new Date(point.endedAt).toISOString(),
      elo: point.elo + point.eloDelta,
      eloDelta: point.eloDelta,
      ...totals,
    };
  });
}

export function buildPlayerExport(username: string) {
  return getPlayerProfile(username).then((profile) => {
    if (!profile) return null;
    return Promise.all([
      listPlayerAchievements(profile.id),
      getPlayerHistory(profile.username),
      listAllGames(profile.id),
      listPlayerMaps({
        page: 1,
        pageSize: MAX_MAPS,
        sort: 'newest',
        authorId: profile.id,
      }),
    ]).then(([achievements, history, games, maps]) => ({
      kind: 'player',
      exportedAt: new Date().toISOString(),
      profile: {
        username: profile.username,
        country: profile.country,
        elo: profile.elo,
        percentile: profile.percentile,
        reputation: profile.reputation,
        memberSince: new Date(profile.createdAt).toISOString(),
        bio: profile.bio,
      },
      stats: {
        gamesPlayed: profile.gamesPlayed,
        wins: profile.wins,
        winRate:
          profile.gamesPlayed === 0
            ? null
            : Math.round((profile.wins / profile.gamesPlayed) * 10000) / 100,
        averagePlacing: profile.averagePlacing,
        troopsGained: profile.troopsGained,
        troopsKilled: profile.troopsKilled,
        troopsLost: profile.troopsLost,
        territoriesConquered: profile.territoriesConquered,
        playersKilled: profile.playersKilled,
        capitalsConquered: profile.capitalsConquered,
        setsPlayed: profile.setsPlayed,
      },
      achievements: achievements.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        achievedAt:
          a.achievedAt === null ? null : new Date(a.achievedAt).toISOString(),
      })),
      statsOverTime: statsOverTime(history),
      games,
      maps: maps.maps.map((m) => ({
        id: m.id,
        name: m.name,
        territories: m.territoryCount,
        continents: m.continentCount,
        likes: m.likeCount,
        createdAt: new Date(m.createdAt).toISOString(),
      })),
    }));
  });
}
