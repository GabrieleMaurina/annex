import {
  areAnimationsDisabled,
  setAnimationsDisabled,
} from '../game/animations';
import { socket } from './socket';
import {
  getSoundVolume,
  isSoundMuted,
  setSoundMuted,
  setSoundVolume,
} from './sounds';
import type { ClientSettings, GameRulesSettings } from './types';

let loggedIn = false;
let playerName = '';
let gameSettings: Record<string, unknown> = {};
let gameSlots = 2;

export function isLoggedIn(): boolean {
  return loggedIn;
}

export function getPlayerName(): string {
  return playerName;
}

export function setPlayerName(name: string): void {
  playerName = name;
}

function currentClientSettings(): ClientSettings {
  return {
    muted: isSoundMuted(),
    animationsDisabled: areAnimationsDisabled(),
    volume: getSoundVolume(),
  };
}

export function applyServerSettings(
  hasAccount: boolean,
  client: ClientSettings | undefined,
  game: Record<string, unknown> | undefined,
) {
  loggedIn = hasAccount;
  if (client) {
    setSoundMuted(!!client.muted);
    setAnimationsDisabled(!!client.animationsDisabled);
    if (typeof client.volume === 'number') setSoundVolume(client.volume);
  }
  if (game) {
    const { slots, ...rest } = game;
    gameSettings = rest;
    gameSlots = typeof slots === 'number' ? slots : 2;
  }
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

export function pushSettings() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    socket.emit('user:updateSettings', {
      clientSettings: currentClientSettings(),
      gameSettings: { ...gameSettings, slots: gameSlots },
    });
  }, 500);
}

export function getGameSettings(): GameRulesSettings {
  return gameSettings as GameRulesSettings;
}

export function getGameSlots(): number {
  return gameSlots;
}

export function saveGameSettings(settings: GameRulesSettings, slots: number) {
  gameSettings = { ...settings };
  gameSlots = slots;
  pushSettings();
}
