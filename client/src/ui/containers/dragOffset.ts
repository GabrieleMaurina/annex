import { useState, type CSSProperties, type PointerEvent } from 'react';
import { CURSOR_GRAB } from '../cursors/cursors';

const DRAG_THRESHOLD = 4;
const TYPING_TARGETS = 'input, textarea, select, .odometer';

function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, true), 0);
}

export function useDragOffset(resetKey: string) {
  const [drag, setDrag] = useState({ key: resetKey, x: 0, y: 0 });
  if (drag.key !== resetKey) setDrag({ key: resetKey, x: 0, y: 0 });

  function start(e: PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest(TYPING_TARGETS)) return;
    const origin = { x: e.clientX, y: e.clientY };
    let moved = false;
    const move = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      setDrag({ key: resetKey, x: drag.x + dx, y: drag.y + dy });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (moved) swallowNextClick();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function shift<T extends CSSProperties | undefined>(style: T): T {
    if (!style) return style;
    return {
      ...style,
      translate: `${drag.x}px ${drag.y}px`,
      cursor: CURSOR_GRAB,
      touchAction: 'none',
    } as T;
  }

  return { start, shift };
}
