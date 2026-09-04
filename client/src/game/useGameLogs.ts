import { useCallback, useEffect, useRef, useState } from 'react';
import { connector } from '../connector';
import type { GameState } from '../lib/types';
import { createLogFormatter } from './logFormat';

export interface LogEntry {
  id: number;
  color: string;
  text: string;
}

const LIVE_EVENTS = [
  'game:deployed',
  'game:fortified',
  'game:attackMoved',
  'game:deployedMany',
  'game:entrenched',
  'game:toxined',
  'game:radiationChanged',
  'game:attacked',
  'game:cardSetPlayed',
  'game:turnStarted',
  'game:capitalPlacementStarted',
  'game:territoryClaimed',
  'game:allianceFormed',
  'game:allianceTerminated',
];

export function useGameLogs(game: GameState | null): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const gameRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameRef.current = game;
  });

  const formatRef = useRef<ReturnType<typeof createLogFormatter> | null>(null);
  if (formatRef.current == null) {
    formatRef.current = createLogFormatter();
  }

  const append = useCallback((entry: { type: string; payload: unknown }) => {
    const parts = formatRef.current!(entry, gameRef.current?.players ?? []);
    if (parts.length === 0) return;
    setLogs((prev) => {
      let id = prev.at(-1)?.id ?? 0;
      return [...prev, ...parts.map((part) => ({ id: ++id, ...part }))];
    });
  }, []);

  const pendingRef = useRef<{ type: string; payload: unknown }[] | null>(null);

  useEffect(() => {
    function onGameLogs(payload: {
      entries: { type: string; payload: unknown }[];
    }) {
      if (gameRef.current) for (const entry of payload.entries) append(entry);
      else pendingRef.current = payload.entries;
    }
    connector.on('game:logs', onGameLogs);
    return () => {
      connector.off('game:logs', onGameLogs);
    };
  }, [append]);

  useEffect(() => {
    if (!game || !pendingRef.current) return;
    const entries = pendingRef.current;
    pendingRef.current = null;
    for (const entry of entries) append(entry);
  }, [game, append]);

  useEffect(() => {
    const handlers = LIVE_EVENTS.map((type) => {
      const handler = (payload: unknown) => append({ type, payload });
      connector.on(type, handler);
      return { type, handler };
    });
    return () => {
      for (const { type, handler } of handlers) connector.off(type, handler);
    };
  }, [append]);

  return logs;
}
