import type { Player } from './types';

const COOKIE_NAME = 'anx';
const MAX_AGE = 60 * 60 * 24 * 365 * 100;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${MAX_AGE}; path=/`;
}

function randomName(): string {
  return `Player${Math.floor(Math.random() * 9000) + 1000}`;
}

export function getPlayer(): Player {
  const raw = readCookie(COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.key && parsed.name) return parsed;
    } catch {}
  }
  const player: Player = { key: crypto.randomUUID(), name: randomName() };
  writeCookie(COOKIE_NAME, JSON.stringify(player));
  return player;
}

export function savePlayer(player: Player) {
  writeCookie(COOKIE_NAME, JSON.stringify(player));
}
