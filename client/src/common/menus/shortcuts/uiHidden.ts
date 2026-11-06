import { useEffect, useSyncExternalStore } from 'react';
import { isTypingTarget } from '../../../game/GameMap/helpers';
import { playSound } from '../../../lib/sounds';
import { getShortcutsOpen } from './shortcutsOpen';

let hidden = false;
const listeners = new Set<() => void>();

function setUiHidden(value: boolean) {
  hidden = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUiHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hidden);
}

export function useHideUiShortcut() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target))
        return;
      const key = e.key.toLowerCase();
      const restoring = key === 'escape' && hidden;
      if (getShortcutsOpen() || (key !== 'h' && !restoring)) return;
      if (restoring) e.stopPropagation();
      playSound('click');
      setUiHidden(!hidden);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      setUiHidden(false);
    };
  }, []);
}
