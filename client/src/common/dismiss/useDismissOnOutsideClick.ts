import type { RefObject } from 'react';
import { useEffect } from 'react';

const KEEP_OPEN_SELECTOR = '[data-keep-panel-open], .modal';

function isCoarsePointer(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function useDismissOnOutsideClick(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active || !isCoarsePointer()) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Element;
      if (containerRef.current?.contains(target)) return;
      if (target.closest(KEEP_OPEN_SELECTOR)) return;
      onDismiss();
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('contextmenu', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('contextmenu', handleOutside);
    };
  }, [active, containerRef, onDismiss]);
}
