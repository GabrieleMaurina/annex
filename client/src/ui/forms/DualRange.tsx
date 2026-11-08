import type { PointerEvent } from 'react';
import { Form } from 'react-bootstrap';

interface Props {
  min: number;
  max: number;
  start: number;
  end: number;
  marker?: number | null;
  disabled?: boolean;
  onChange: (start: number, end: number) => void;
  onScrub?: (value: number | null) => void;
  onSeek?: (value: number) => void;
}

function DualRange({
  min,
  max,
  start,
  end,
  marker,
  disabled,
  onChange,
  onScrub,
  onSeek,
}: Props) {
  const span = Math.max(1, max - min);
  const edge = (value: number) =>
    `calc(0.5rem + (100% - 1rem) * ${(value - min) / span})`;
  const seekFrom = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pad =
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 2;
    const fraction = Math.min(
      1,
      Math.max(
        0,
        (e.clientX - rect.left - pad) / Math.max(1, rect.width - pad * 2),
      ),
    );
    onSeek?.(Math.round(min + fraction * span));
  };
  const endScrub = () => onScrub?.(null);
  const beginScrub = (value: number) => {
    onScrub?.(value);
    const release = () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      onScrub?.(null);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  };

  return (
    <div
      className="dual-range"
      onPointerDown={(e) => {
        if (disabled || !onSeek || e.target instanceof HTMLInputElement) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFrom(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFrom(e);
      }}
    >
      <div className="dual-range-track position-absolute top-50 start-0 end-0 translate-middle-y rounded-pill">
        <div
          className="position-absolute top-0 bottom-0 rounded-pill bg-primary"
          style={{ left: edge(start), right: `calc(100% - ${edge(end)})` }}
        />
      </div>
      {marker != null && (
        <div
          className="dual-range-marker position-absolute top-0 bottom-0 z-2 pe-none bg-warning"
          style={{ left: edge(marker) }}
        />
      )}
      <Form.Range
        className={start - min > span / 2 ? 'z-1' : undefined}
        min={min}
        max={max}
        value={start}
        aria-label="Trim start"
        disabled={disabled}
        onPointerDown={() => beginScrub(start)}
        onKeyUp={endScrub}
        onChange={(e) => {
          const next = Math.min(Number(e.target.value), end - 1);
          onChange(next, end);
          onScrub?.(next);
        }}
      />
      <Form.Range
        min={min}
        max={max}
        value={end}
        aria-label="Trim end"
        disabled={disabled}
        onPointerDown={() => beginScrub(end)}
        onKeyUp={endScrub}
        onChange={(e) => {
          const next = Math.max(Number(e.target.value), start + 1);
          onChange(start, next);
          onScrub?.(next);
        }}
      />
    </div>
  );
}

export default DualRange;
