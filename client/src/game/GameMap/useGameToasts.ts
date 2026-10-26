import { useCallback, useState } from 'react';
import type { GameToast } from './overlays/GameToasts';

export function useGameToasts() {
  const [toasts, setToasts] = useState<GameToast[]>([]);
  const addToasts = useCallback(
    (messages: string[], delay?: number) =>
      setToasts((prev) => [
        ...prev,
        ...messages.map((m, i) => ({ id: Date.now() + i, message: m, delay })),
      ]),
    [],
  );
  return { toasts, setToasts, addToasts };
}
