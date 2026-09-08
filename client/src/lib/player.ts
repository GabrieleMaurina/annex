import {
  areAnimationsDisabled,
  setAnimationsDisabled,
} from '../game/animations';
import { httpSend } from './http';
import {
  getSoundVolume,
  isSoundMuted,
  setSoundMuted,
  setSoundVolume,
} from './sounds';
import type {
  ClientSettings,
  GameRulesSettings,
  HomeFilters,
  SavedBot,
} from './types';

let loggedIn = false;
let playerName = '';
let gameSettings: Record<string, unknown> = {};
let gameSlots = 2;
let gameBots: SavedBot[] = [];
let gameLocalPlayers: string[] = [];
let homeFilters: HomeFilters | undefined;
const restoredBotInputs = new Map<number, SavedBot>();

const nameListeners = new Set<() => void>();

export function isLoggedIn(): boolean {
  return loggedIn;
}

export function getPlayerName(): string {
  return playerName;
}

export function setPlayerName(name: string): void {
  if (name === playerName) return;
  playerName = name;
  nameListeners.forEach((listener) => listener());
}

export function subscribePlayerName(listener: () => void): () => void {
  nameListeners.add(listener);
  return () => {
    nameListeners.delete(listener);
  };
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
  home: HomeFilters | undefined,
) {
  loggedIn = hasAccount;
  if (client) {
    setSoundMuted(!!client.muted);
    setAnimationsDisabled(!!client.animationsDisabled);
    if (typeof client.volume === 'number') setSoundVolume(client.volume);
  }
  if (game) {
    const { slots, bots, localPlayers, ...rest } = game;
    gameSettings = rest;
    gameSlots = typeof slots === 'number' ? slots : 2;
    gameBots = Array.isArray(bots) ? (bots as SavedBot[]) : [];
    gameLocalPlayers = Array.isArray(localPlayers)
      ? (localPlayers as string[])
      : [];
  }
  if (home) homeFilters = home;
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

export function pushSettings() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    httpSend('PATCH', '/settings', {
      clientSettings: currentClientSettings(),
      gameSettings: {
        ...gameSettings,
        slots: gameSlots,
        bots: gameBots,
        localPlayers: gameLocalPlayers,
      },
      homeFilters,
    }).catch(() => {});
  }, 500);
}

export function getGameSettings(): GameRulesSettings {
  return gameSettings as GameRulesSettings;
}

export function getGameSlots(): number {
  return gameSlots;
}

export function getGameBots(): SavedBot[] {
  return gameBots;
}

export function getGameLocalPlayers(): string[] {
  return gameLocalPlayers;
}

export function resetRestoredBotInputs(): void {
  restoredBotInputs.clear();
}

export function recordRestoredBotInput(botId: number, bot: SavedBot): void {
  restoredBotInputs.set(botId, bot);
}

export function getRestoredBotInput(botId: number): SavedBot | undefined {
  return restoredBotInputs.get(botId);
}

export function getHomeFilters(): HomeFilters | undefined {
  return homeFilters;
}

export function saveGameSettings(
  settings: GameRulesSettings,
  slots: number,
  bots: SavedBot[],
  localPlayers: string[],
) {
  gameSettings = { ...settings };
  gameSlots = slots;
  gameBots = bots;
  gameLocalPlayers = localPlayers;
  pushSettings();
}

export function saveHomeFilters(filters: HomeFilters) {
  homeFilters = { ...filters };
  pushSettings();
}
