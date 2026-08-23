import {
  areAnimationsDisabled,
  setAnimationsDisabled,
} from '../game/animations';
import {
  getSoundVolume,
  isSoundMuted,
  setSoundMuted,
  setSoundVolume,
} from './sounds';
import type { GameRulesSettings, Player } from './types';

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

function currentSettings(): Player['settings'] {
  return {
    muted: isSoundMuted(),
    animationsDisabled: areAnimationsDisabled(),
    volume: getSoundVolume(),
  };
}

export function getPlayer(): Player {
  const raw = readCookie(COOKIE_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.key && parsed.name) {
        if (parsed.settings) {
          setSoundMuted(!!parsed.settings.muted);
          setAnimationsDisabled(!!parsed.settings.animationsDisabled);
          if (typeof parsed.settings.volume === 'number')
            setSoundVolume(parsed.settings.volume);
        }
        return parsed;
      }
    } catch {}
  }
  const player: Player = { key: crypto.randomUUID(), name: randomName() };
  writeCookie(COOKIE_NAME, JSON.stringify(player));
  return player;
}

export function savePlayer(player: Player) {
  writeCookie(
    COOKIE_NAME,
    JSON.stringify({ ...player, settings: currentSettings() }),
  );
}

export function saveSettings() {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.key || !parsed.name) return;
    writeCookie(
      COOKIE_NAME,
      JSON.stringify({ ...parsed, settings: currentSettings() }),
    );
  } catch {}
}

export function getGameSettings(): GameRulesSettings | null {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.gameSettings ?? null;
  } catch {
    return null;
  }
}

export function saveGameSettings(gameSettings: GameRulesSettings) {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.key || !parsed.name) return;
    writeCookie(COOKIE_NAME, JSON.stringify({ ...parsed, gameSettings }));
  } catch {}
}
