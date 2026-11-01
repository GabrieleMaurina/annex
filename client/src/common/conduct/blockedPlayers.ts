import { useSyncExternalStore } from 'react';
import { connector } from '../../connector';

let blockedIds: number[] = [];
const listeners = new Set<() => void>();

connector.on('game:blockedPlayers', (payload: { playerIds: number[] }) => {
  blockedIds = payload.playerIds;
  for (const listener of listeners) listener();
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBlockedPlayer(playerId: number): boolean {
  return useSyncExternalStore(subscribe, () => blockedIds).includes(playerId);
}
