const mutedPlayerIds = new Set<number>();

export function isPlayerMuted(playerId: number): boolean {
  return mutedPlayerIds.has(playerId);
}

export function toggleMutePlayer(playerId: number) {
  if (mutedPlayerIds.has(playerId)) mutedPlayerIds.delete(playerId);
  else mutedPlayerIds.add(playerId);
}
