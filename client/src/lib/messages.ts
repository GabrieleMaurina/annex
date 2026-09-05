import { connector } from '../connector';
import type { MessagesOverview } from './types';

const READ_KEY = 'annex.messagesRead';
const POLL_MS = 15000;
const EMPTY: MessagesOverview = { conversations: [], blocked: [] };

let overview: MessagesOverview = EMPTY;
let enabled = false;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function fetchNow(): void {
  if (!enabled || document.visibilityState === 'hidden') return;
  connector.listMessages((next) => {
    overview = next;
    emit();
  });
}

function sync(): void {
  const shouldPoll = enabled && listeners.size > 0;
  if (shouldPoll && timer === undefined) {
    fetchNow();
    timer = setInterval(fetchNow, POLL_MS);
  } else if (!shouldPoll && timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

export function setMessagesEnabled(value: boolean): void {
  if (enabled === value) return;
  enabled = value;
  if (!enabled) {
    overview = EMPTY;
    emit();
  }
  sync();
}

export function subscribeMessages(listener: () => void): () => void {
  listeners.add(listener);
  sync();
  return () => {
    listeners.delete(listener);
    sync();
  };
}

export function getMessagesSnapshot(): MessagesOverview {
  return overview;
}

export function refreshMessages(): void {
  fetchNow();
}

function readMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function markConversationRead(userId: string, createdAt: number): void {
  const map = readMap();
  if ((map[userId] ?? 0) >= createdAt) return;
  map[userId] = createdAt;
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(map));
  } catch {}
  overview = { ...overview };
  emit();
}

export function unreadCount(
  conversation: {
    userId: string;
    messages: { fromMe: boolean; createdAt: number }[];
  },
  reads: Record<string, number> = readMap(),
): number {
  const seen = reads[conversation.userId] ?? 0;
  return conversation.messages.filter((m) => !m.fromMe && m.createdAt > seen)
    .length;
}

export function totalUnread(current: MessagesOverview): number {
  const reads = readMap();
  return current.conversations.reduce(
    (sum, c) => sum + unreadCount(c, reads),
    0,
  );
}
