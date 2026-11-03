import { playerIdByUserId, socketIdByPlayerId } from '../sockets/socketRooms';

const ONLINE_MS = 5 * 60 * 1000;

const lastSeenByUserId = new Map<string, number>();

export function markSeen(userId: string): void {
  const now = Date.now();
  lastSeenByUserId.delete(userId);
  lastSeenByUserId.set(userId, now);
  for (const [id, seenAt] of lastSeenByUserId) {
    if (now - seenAt <= ONLINE_MS) break;
    lastSeenByUserId.delete(id);
  }
}

export function isOnline(userId: string): boolean {
  const seenAt = lastSeenByUserId.get(userId);
  if (seenAt !== undefined && Date.now() - seenAt <= ONLINE_MS) return true;
  const playerId = playerIdByUserId.get(userId);
  return playerId !== undefined && socketIdByPlayerId.has(playerId);
}
