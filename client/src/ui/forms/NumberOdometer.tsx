import type { ComponentProps, CSSProperties } from 'react';
import { useRef, useState } from 'react';
import { DRAG_THRESHOLD } from '../../common/inputs/useNumberInput';

const DRAG_SETTLE_MS = 500;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const STOP_TYPING_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Escape',
];

function NumberOdometer({
  className = '',
  style,
  value,
  onFocus,
  onBlur,
  onChange,
  ...inputProps
}: ComponentProps<'input'>) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const pointerDown = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastDragAt = useRef(0);
  const digits = String(value ?? '').replace(/\D/g, '') || '0';

  function stopTyping() {
    setTyping(false);
    setDraft(null);
  }

  function justDragged() {
    return Date.now() - lastDragAt.current < DRAG_SETTLE_MS;
  }

  function endPointer() {
    pointerDown.current = false;
    if (lastDragAt.current !== 0) lastDragAt.current = Date.now();
  }

  return (
    <span
      className={`odometer ${typing ? 'odometer-typing' : ''} ${className}`}
      style={style}
      onPointerDownCapture={(e) => {
        pointerDown.current = true;
        lastDragAt.current = 0;
        dragStart.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMoveCapture={(e) => {
        if (!pointerDown.current) return;
        const moved = Math.max(
          Math.abs(e.clientX - dragStart.current.x),
          Math.abs(e.clientY - dragStart.current.y),
        );
        if (moved >= DRAG_THRESHOLD) lastDragAt.current = Date.now();
      }}
      onPointerUpCapture={endPointer}
      onPointerCancelCapture={endPointer}
      onMouseDownCapture={(e) => {
        if (justDragged()) e.preventDefault();
      }}
      onClickCapture={(e) => {
        if (!justDragged() && e.target === document.activeElement)
          setTyping(true);
      }}
      onWheelCapture={stopTyping}
      onKeyDownCapture={(e) => {
        if (STOP_TYPING_KEYS.includes(e.key)) stopTyping();
      }}
    >
      <span className="odometer-window" aria-hidden="true">
        {[...digits].map((digit, index) => (
          <span key={digits.length - index} className="odometer-drum">
            <span
              className="odometer-strip"
              style={{ '--odometer-digit': digit } as CSSProperties}
            >
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ))}
      </span>
      <input
        {...inputProps}
        type="number"
        className="odometer-input"
        value={draft ?? value}
        onFocus={(e) => {
          if (justDragged()) {
            e.currentTarget.blur();
            return;
          }
          if (!pointerDown.current) setTyping(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          stopTyping();
          onBlur?.(e);
        }}
        onChange={(e) => {
          setTyping(true);
          if ((e.nativeEvent as InputEvent).inputType) setDraft(e.target.value);
          onChange?.(e);
        }}
      />
    </span>
  );
}

export default NumberOdometer;
