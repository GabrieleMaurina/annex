import { playerIdByUserId, socketIdByPlayerId } from '../sockets/socketRooms';

const LIVE_MS = 12 * 1000;

const lastSeenByUserId = new Map<string, number>();

export function markSeen(userId: string): void {
  const now = Date.now();
  lastSeenByUserId.delete(userId);
  lastSeenByUserId.set(userId, now);
  for (const [id, seenAt] of lastSeenByUserId) {
    if (now - seenAt <= LIVE_MS) break;
    lastSeenByUserId.delete(id);
  }
}

export function isLive(userId: string): boolean {
  const seenAt = lastSeenByUserId.get(userId);
  return seenAt !== undefined && Date.now() - seenAt <= LIVE_MS;
}

export function isOnline(userId: string): boolean {
  if (isLive(userId)) return true;
  const playerId = playerIdByUserId.get(userId);
  return playerId !== undefined && socketIdByPlayerId.has(playerId);
}
