import { DEFAULT_ELO, getElosByIds, setElos } from './db';
import { userIdByPlayerId } from './socketRooms';

const K = 32;
const LOSS_DAMP_ELO = 1500;
const MAX_ELO = 3100;

function lossDamp(rating: number): number {
  return Math.min(1, Math.max(0, rating / LOSS_DAMP_ELO));
}

export interface GameElo {
  elo: number;
  eloDelta: number;
}

const participantsByGame = new Map<string, Map<number, string>>();
const elosByGame = new Map<string, Map<number, GameElo>>();

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

export function gameElos(gameName: string): Map<number, GameElo> {
  return elosByGame.get(gameName) ?? new Map();
}

export function reconcileGameElos(existing: Set<string>): void {
  for (const name of [...elosByGame.keys()]) {
    if (!existing.has(name)) elosByGame.delete(name);
  }
}

export function handleGameEnded(payload: {
  gameName: string;
  gameMode: string;
  roundNumber: number;
  ranking: { playerId: number; team: number }[];
}): Promise<Map<number, GameElo>> {
  const participants = participantsByGame.get(payload.gameName);
  participantsByGame.delete(payload.gameName);
  elosByGame.delete(payload.gameName);
  const noElos = Promise.resolve(new Map<number, GameElo>());
  if (!participants || participants.size === 0) return noElos;
  if (payload.roundNumber < 1) return noElos;

  const isTeam = payload.gameMode === 'Team Deathmatch';
  const ranked = payload.ranking
    .map((entry, rank) => ({
      rank,
      playerId: entry.playerId,
      team: entry.team,
      userId: participants.get(entry.playerId),
    }))
    .filter(
      (
        entry,
      ): entry is {
        rank: number;
        playerId: number;
        team: number;
        userId: string;
      } => entry.userId !== undefined,
    );
  const contenders = ranked.length < 2 ? [] : ranked;

  return getElosByIds([...participants.values()])
    .then((ratings) => {
      const updates: { userId: string; elo: number }[] = [];
      const elos = new Map<number, GameElo>(
        [...participants].map(([playerId, userId]) => [
          playerId,
          { elo: ratings.get(userId) ?? DEFAULT_ELO, eloDelta: 0 },
        ]),
      );
      for (const player of contenders) {
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
          delta +=
            score === 1 ? K * (1 - expected) : -K * expected * lossDamp(rating);
          opponents += 1;
        }
        if (opponents === 0) continue;
        const nextRating = Math.min(
          MAX_ELO,
          Math.max(0, Math.round(rating + delta / opponents)),
        );
        updates.push({ userId: player.userId, elo: nextRating });
        elos.set(player.playerId, {
          elo: rating,
          eloDelta: nextRating - rating,
        });
      }
      return setElos(updates).then(() => {
        elosByGame.set(payload.gameName, elos);
        return elos;
      });
    })
    .catch(() => new Map<number, GameElo>());
}
