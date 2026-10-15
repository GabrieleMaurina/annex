import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { playSound } from '../../lib/sounds';

const PIXELS_PER_STEP = 8;
const DRAG_THRESHOLD = 4;

export function modifierStep(e: {
  ctrlKey: boolean;
  shiftKey: boolean;
}): number {
  return e.shiftKey ? 10 : e.ctrlKey ? 5 : 1;
}

export function wheelDirection(e: { deltaX: number; deltaY: number }): 1 | -1 {
  return (e.deltaY || e.deltaX) < 0 ? 1 : -1;
}

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
    steps: number;
    dragging: boolean;
  } | null>(null);
  const pointerStepRef = useRef(1);
  const latestRef = useRef({ value, min, max, onChange });

  useLayoutEffect(() => {
    latestRef.current = { value, min, max, onChange };
  });

  const step = useCallback((delta: number) => {
    const latest = latestRef.current;
    const next = Math.min(
      latest.max,
      Math.max(latest.min, latest.value + delta),
    );
    if (next === latest.value) return;
    latest.value = next;
    playSound('click');
    latest.onChange(next);
  }, []);

  const ref = useCallback(
    (el: HTMLInputElement | null) => {
      if (inputRef) inputRef.current = el;
      if (!el) return;
      function onWheel(e: WheelEvent) {
        e.preventDefault();
        e.stopPropagation();
        step(wheelDirection(e) * modifierStep(e));
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
    step(delta * modifierStep(e));
  }

  function onInput(e: React.FormEvent<HTMLElement>) {
    if ((e.nativeEvent as InputEvent).inputType) return;
    const input = e.currentTarget as HTMLInputElement;
    const latest = latestRef.current;
    const direction = Math.sign(Number(input.value) - latest.value);
    if (direction === 0) return;
    const next = Math.min(
      latest.max,
      Math.max(latest.min, latest.value + direction * pointerStepRef.current),
    );
    input.value = String(next);
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    pointerStepRef.current = modifierStep(e);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      steps: 0,
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
    const steps = Math.round(dy / PIXELS_PER_STEP);
    if (steps === drag.steps) return;
    step((steps - drag.steps) * modifierStep(e));
    drag.steps = steps;
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
    onInput,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { touchAction: 'none' as const },
  };
}
