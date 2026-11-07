import { useCallback, useState } from 'react';
import type { GameToast } from './overlays/GameToasts';
import { nextToastId } from './toastId';

export function useGameToasts() {
  const [toasts, setToasts] = useState<GameToast[]>([]);
  const addToasts = useCallback(
    (messages: string[], delay?: number) =>
      setToasts((prev) => [
        ...prev,
        ...messages.map((m) => ({ id: nextToastId(), message: m, delay })),
      ]),
    [],
  );
  return { toasts, setToasts, addToasts };
}
