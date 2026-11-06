import { nextFreeColor } from 'engine';
import { useMemo, useSyncExternalStore } from 'react';
import { connector } from '../../connector';
import type { GameState } from '../../lib/types';

type Overrides = Record<number, number>;

const STORAGE_KEY = 'annex.colorOverrides';
const NO_OVERRIDES: Overrides = {};
const listeners = new Set<() => void>();
let overridesByGame = load();

function load(): Record<string, Overrides> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Overrides>) : {};
  } catch {
    return {};
  }
}

function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overridesByGame));
  } catch {
    return;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setOverride(gameKey: string, playerId: number, color: number | null) {
  const overrides = { ...overridesByGame[gameKey] };
  if (color === null) delete overrides[playerId];
  else overrides[playerId] = color;
  overridesByGame = { ...overridesByGame, [gameKey]: overrides };
  save();
  for (const listener of listeners) listener();
}

export function useLocalColors(game: GameState | null) {
  const enabled = !!game && game.state !== 'lobby' && !connector.isTutorial();
  const gameKey = enabled ? `${game.name}:${game.startedAt}` : '';
  const overrides = useSyncExternalStore(
    subscribe,
    () => overridesByGame[gameKey] ?? NO_OVERRIDES,
  );
  const shownGame = useMemo(
    () =>
      game && {
        ...game,
        players: game.players.map((p) => ({
          ...p,
          color: overrides[p.id] ?? p.color,
        })),
      },
    [game, overrides],
  );
  const recoloredIds = useMemo(
    () => new Set(Object.keys(overrides).map(Number)),
    [overrides],
  );

  function cycleColor(playerId: number) {
    if (!game || !shownGame) return;
    const current = shownGame.players.find((p) => p.id === playerId);
    if (!current) return;
    const usedByOthers = new Set(
      shownGame.players.filter((p) => p.id !== playerId).map((p) => p.color),
    );
    const color = nextFreeColor(
      current.color,
      usedByOthers,
      shownGame.players.length,
    );
    const original =
      game.players.find((p) => p.id === playerId)?.color ?? current.color;
    const wrappedPastOriginal =
      color < current.color &&
      original > current.color &&
      !usedByOthers.has(original);
    setOverride(
      gameKey,
      playerId,
      color === original || wrappedPastOriginal ? null : color,
    );
  }

  return {
    shownGame,
    recoloredIds,
    cycleColor: enabled ? cycleColor : undefined,
  };
}
