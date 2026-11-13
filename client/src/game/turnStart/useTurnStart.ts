import { useEffect, useRef, type RefObject } from 'react';
import { areAnimationsDisabled, setTurnStartActive } from '../animations';
import {
  TURN_START_MS,
  type TurnFlash,
  type TurnStartOverlay,
} from './turnStart';

export function useTurnStart(
  turnFlash: TurnFlash | null | undefined,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  startAnimationLoop: () => void,
) {
  const overlayRef = useRef<TurnStartOverlay | null>(null);

  useEffect(() => {
    if (!turnFlash || areAnimationsDisabled()) return;
    const overlay = {
      startedAt: performance.now(),
      playerId: turnFlash.playerId,
      bannerShown: true,
    };
    overlayRef.current = overlay;
    setTurnStartActive(true);
    startAnimationLoop();
    canvasRef.current?.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.03)', filter: 'brightness(1.6)', offset: 0.2 },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: TURN_START_MS, easing: 'ease-out' },
    );

    function dismissBanner() {
      overlay.bannerShown = false;
      startAnimationLoop();
    }
    window.addEventListener('pointerdown', dismissBanner, true);

    const timer = setTimeout(() => {
      overlayRef.current = null;
      setTurnStartActive(false);
      startAnimationLoop();
    }, TURN_START_MS);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', dismissBanner, true);
      overlayRef.current = null;
      setTurnStartActive(false);
    };
  }, [turnFlash, canvasRef, startAnimationLoop]);

  return overlayRef;
}
