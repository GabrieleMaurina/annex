import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

const PIXELS_PER_STEP = 8;
const DRAG_THRESHOLD = 4;

interface Options {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function useNumberInput({
  value,
  min,
  max,
  onChange,
  inputRef,
}: Options) {
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startValue: number;
    dragging: boolean;
  } | null>(null);
  const latestRef = useRef({ value, min, max, onChange });

  useLayoutEffect(() => {
    latestRef.current = { value, min, max, onChange };
  });

  const step = useCallback((delta: 1 | -1) => {
    const latest = latestRef.current;
    const next = Math.min(
      latest.max,
      Math.max(latest.min, latest.value + delta),
    );
    if (next === latest.value) return;
    latest.value = next;
    latest.onChange(next);
  }, []);

  const ref = useCallback(
    (el: HTMLInputElement | null) => {
      if (inputRef) inputRef.current = el;
      if (!el) return;
      function onWheel(e: WheelEvent) {
        e.preventDefault();
        e.stopPropagation();
        step(e.deltaY < 0 ? 1 : -1);
      }
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        el.removeEventListener('wheel', onWheel);
        if (inputRef) inputRef.current = null;
      };
    },
    [inputRef, step],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const delta =
      e.key === 'ArrowUp' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (delta === 0) return;
    e.preventDefault();
    e.stopPropagation();
    step(delta);
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startValue: value,
      dragging: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = drag.startY - e.clientY;
    if (!drag.dragging) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;
      drag.dragging = true;
      e.currentTarget.setPointerCapture(drag.pointerId);
      e.currentTarget.blur();
    }
    e.preventDefault();
    const next = Math.min(
      max,
      Math.max(min, drag.startValue + Math.round(dy / PIXELS_PER_STEP)),
    );
    if (next !== value) onChange(next);
  }

  function endDrag(e: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (drag?.dragging && e.currentTarget.hasPointerCapture(drag.pointerId)) {
      e.currentTarget.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
  }

  return {
    ref,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { touchAction: 'none' as const },
  };
}
