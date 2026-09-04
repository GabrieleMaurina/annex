import { DEFAULT_ELO, getElosByIds, setElos } from './db';
import { userIdByPlayerId } from './socketRooms';

const K = 32;

const participantsByGame = new Map<string, Map<number, string>>();

export function recordGameParticipants(game: {
  name: string;
  players: { id: number }[];
}): void {
  const byPlayerId = new Map<number, string>();
  for (const player of game.players) {
    const userId = userIdByPlayerId(player.id);
    if (userId !== undefined) byPlayerId.set(player.id, userId);
  }
  participantsByGame.set(game.name, byPlayerId);
}

export function gameParticipants(gameName: string): Map<number, string> {
  return participantsByGame.get(gameName) ?? new Map();
}

export function handleGameEnded(payload: {
  gameName: string;
  gameMode: string;
  roundNumber: number;
  ranking: { playerId: number; team: number }[];
}): void {
  const participants = participantsByGame.get(payload.gameName);
  participantsByGame.delete(payload.gameName);
  if (!participants) return;
  if (payload.roundNumber < 1) return;

  const isTeam = payload.gameMode === 'Team Deathmatch';
  const ranked = payload.ranking
    .map((entry, rank) => ({
      rank,
      team: entry.team,
      userId: participants.get(entry.playerId),
    }))
    .filter(
      (entry): entry is { rank: number; team: number; userId: string } =>
        entry.userId !== undefined,
    );
  if (ranked.length < 2) return;

  getElosByIds(ranked.map((entry) => entry.userId))
    .then((ratings) => {
      const updates: { userId: string; elo: number }[] = [];
      for (const player of ranked) {
        const rating = ratings.get(player.userId) ?? DEFAULT_ELO;
        let delta = 0;
        let opponents = 0;
        for (const opponent of ranked) {
          if (opponent === player) continue;
          if (isTeam && opponent.team === player.team) continue;
          const opponentRating = ratings.get(opponent.userId) ?? DEFAULT_ELO;
          const expected =
            1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
          const score = player.rank < opponent.rank ? 1 : 0;
          delta += K * (score - expected);
          opponents += 1;
        }
        if (opponents === 0) continue;
        updates.push({
          userId: player.userId,
          elo: Math.round(rating + delta / opponents),
        });
      }
      return setElos(updates);
    })
    .catch(() => {});
}
