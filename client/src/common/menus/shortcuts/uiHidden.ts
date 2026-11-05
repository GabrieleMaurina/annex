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
      if (getShortcutsOpen() || e.key.toLowerCase() !== 'h') return;
      playSound('click');
      setUiHidden(!hidden);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      setUiHidden(false);
    };
  }, []);
}
