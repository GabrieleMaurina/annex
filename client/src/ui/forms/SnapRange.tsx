import { useCallback, useEffect, useRef } from 'react';
import { Form } from 'react-bootstrap';
import Tip from '../../common/tooltips/Tip';

interface Props {
  tip: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const MIDDLE = 0.5;
const SNAP = 0.08;
const WHEEL_STEP = 0.02;
const WHEEL_IDLE_MS = 400;

function snapToMiddle(value: number): number {
  return Math.abs(value - MIDDLE) <= SNAP ? MIDDLE : value;
}

function SnapRange({
  tip,
  value,
  step = 0.01,
  onChange,
  onDragStart,
  onDragEnd,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardRef = useRef(false);
  const activeRef = useRef(false);
  const idleRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ value, onChange, onDragStart, onDragEnd });

  useEffect(() => {
    latest.current = { value, onChange, onDragStart, onDragEnd };
  });

  const begin = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    latest.current.onDragStart?.();
  }, []);

  const end = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    latest.current.onDragEnd?.();
  }, []);

  useEffect(() => {
    const input = inputRef.current!;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const current = latest.current.value;
      const moved = current + (e.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP);
      let next = Math.min(1, Math.max(0, moved));
      if ((current - MIDDLE) * (next - MIDDLE) < 0) next = MIDDLE;
      begin();
      latest.current.onChange(next);
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(end, WHEEL_IDLE_MS);
    }
    input.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      input.removeEventListener('wheel', onWheel);
      clearTimeout(idleRef.current);
    };
  }, [begin, end]);

  function startPointerDrag() {
    keyboardRef.current = false;
    begin();
    const finish = () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      end();
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  const atMiddle = Math.abs(value - MIDDLE) < 1e-9;

  return (
    <Tip text={tip}>
      <Form.Range
        ref={inputRef}
        className={`annex-volume-range${atMiddle ? ' at-middle' : ''}`}
        min={0}
        max={1}
        step={step}
        value={value}
        onKeyDown={() => {
          keyboardRef.current = true;
        }}
        onPointerDown={startPointerDrag}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(keyboardRef.current ? next : snapToMiddle(next));
        }}
        style={
          {
            '--annex-volume-progress': `${value * 100}%`,
          } as React.CSSProperties
        }
      />
    </Tip>
  );
}

export default SnapRange;
