import { useRef } from 'react';

const PIXELS_PER_STEP = 8;
const DRAG_THRESHOLD = 4;

interface Options {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function useDragNumber({ value, min, max, onChange }: Options) {
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startValue: number;
    dragging: boolean;
  } | null>(null);

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
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { touchAction: 'none' as const },
  };
}
