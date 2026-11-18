import { useSyncExternalStore } from 'react';
import { connector } from '../../connector';
import type { InviteSetup, InvitesOverview } from '../../lib/types';

const POLL_MS = 3000;
const EMPTY: InvitesOverview = { incoming: [], outgoing: [] };

let overview = EMPTY;
let signature = JSON.stringify(EMPTY);
let enabled = false;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
const hostSetups = new Map<string, InviteSetup>();

function publish(next: InvitesOverview): void {
  const nextSignature = JSON.stringify(next);
  if (nextSignature === signature) return;
  signature = nextSignature;
  overview = next;
  for (const listener of listeners) listener();
}

export function refreshInvites(): void {
  if (!enabled || document.visibilityState === 'hidden') return;
  connector.listInvites((next) => {
    if (enabled) publish(next);
  });
}

export function setInvitesEnabled(value: boolean): void {
  if (enabled === value) return;
  enabled = value;
  if (enabled) {
    refreshInvites();
    timer = setInterval(refreshInvites, POLL_MS);
    document.addEventListener('visibilitychange', refreshInvites);
    return;
  }
  clearInterval(timer);
  document.removeEventListener('visibilitychange', refreshInvites);
  publish(EMPTY);
}

function subscribeInvites(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getInvitesSnapshot(): InvitesOverview {
  return overview;
}

export function useInvites(): InvitesOverview {
  return useSyncExternalStore(subscribeInvites, getInvitesSnapshot);
}

export function rememberHostSetup(gameName: string, setup: InviteSetup): void {
  hostSetups.set(gameName, setup);
}

export function takeHostSetup(gameName: string): InviteSetup | undefined {
  const setup = hostSetups.get(gameName);
  hostSetups.delete(gameName);
  return setup;
}
