import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../../lib/types';
import { setEndCardActive } from '../animations';
import {
  END_CARD_SHOWN_MS,
  endCardFor,
  loadEndCardLogo,
  type EndCardOverlay,
} from './endCard';

export function useEndCard(
  game: GameState,
  endCardShown: boolean,
  startAnimationLoop: () => void,
): () => EndCardOverlay | null {
  const endCard = useMemo(
    () => (endCardShown ? endCardFor(game) : null),
    [endCardShown, game],
  );
  const startRef = useRef<number | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    loadEndCardLogo().then(setLogo);
  }, []);

  useEffect(() => {
    if (!endCardShown) {
      startRef.current = null;
      return;
    }
    startRef.current = performance.now();
    setEndCardActive(true);
    startAnimationLoop();
    const timer = setTimeout(() => {
      setEndCardActive(false);
      startAnimationLoop();
    }, END_CARD_SHOWN_MS);
    return () => {
      clearTimeout(timer);
      setEndCardActive(false);
    };
  }, [endCardShown, startAnimationLoop]);

  return () =>
    endCard && startRef.current !== null
      ? { card: endCard, startedAt: startRef.current, logo }
      : null;
}
