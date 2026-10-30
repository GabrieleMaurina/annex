import type { ComponentProps, CSSProperties } from 'react';
import { useRef, useState } from 'react';

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
  const pointerDown = useRef(false);
  const digits = String(value ?? '').replace(/\D/g, '') || '0';

  return (
    <span
      className={`odometer ${typing ? 'odometer-typing' : ''} ${className}`}
      style={style}
      onPointerDownCapture={() => {
        pointerDown.current = true;
      }}
      onPointerUpCapture={() => {
        pointerDown.current = false;
      }}
      onPointerCancelCapture={() => {
        pointerDown.current = false;
      }}
      onClickCapture={(e) => {
        if (e.target === document.activeElement) setTyping(true);
      }}
      onWheelCapture={() => setTyping(false)}
      onKeyDownCapture={(e) => {
        if (STOP_TYPING_KEYS.includes(e.key)) setTyping(false);
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
        value={value}
        onFocus={(e) => {
          if (!pointerDown.current) setTyping(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setTyping(false);
          onBlur?.(e);
        }}
        onChange={(e) => {
          setTyping(true);
          onChange?.(e);
        }}
      />
    </span>
  );
}

export default NumberOdometer;
