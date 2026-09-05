import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { playSound } from '../lib/sounds';

const LABEL_STYLE = { minWidth: 120, flexShrink: 0 };

function clampInt(
  value: number,
  lo: number,
  hi: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(value)));
}

export function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`${wide ? 'col-12 col-md-8 col-xl-6' : 'col-12 col-sm-6 col-md-4 col-xl-3'} d-flex align-items-center gap-2`}
    >
      <Form.Label className="mb-0" style={LABEL_STYLE}>
        {label}
      </Form.Label>
      {children}
    </div>
  );
}

export function RangeField({
  label,
  min,
  max,
  lo,
  hi,
  fallbackLo,
  fallbackHi,
  setLo,
  setHi,
}: {
  label: string;
  min: number;
  max: number;
  lo: number;
  hi: number;
  fallbackLo: number;
  fallbackHi: number;
  setLo: (v: number) => void;
  setHi: (v: number) => void;
}) {
  return (
    <Field label={label} wide>
      <div className="d-flex align-items-center gap-1 flex-wrap flex-sm-nowrap">
        <span className="small text-muted">From</span>
        <Form.Control
          size="sm"
          type="number"
          min={min}
          max={max}
          style={{ width: 76 }}
          value={lo}
          onChange={(e) =>
            setLo(
              clampInt(
                (e.target as HTMLInputElement).valueAsNumber,
                min,
                max,
                fallbackLo,
              ),
            )
          }
        />
        <span className="small text-muted">To</span>
        <Form.Control
          size="sm"
          type="number"
          min={min}
          max={max}
          style={{ width: 76 }}
          value={hi}
          onChange={(e) =>
            setHi(
              clampInt(
                (e.target as HTMLInputElement).valueAsNumber,
                min,
                max,
                fallbackHi,
              ),
            )
          }
        />
      </div>
    </Field>
  );
}

export function SortSelect({
  value,
  onChange,
  children,
  after,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <Form
      className="d-flex flex-wrap align-items-end justify-content-center row-gap-3 column-gap-3 mb-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <Form.Group className="d-flex align-items-center gap-2">
        <Form.Label className="mb-0 small">Sort</Form.Label>
        <Form.Select
          size="sm"
          className="w-auto"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </Form.Select>
      </Form.Group>
      {after}
    </Form>
  );
}

export function FilterDetails({
  onClear,
  children,
}: {
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mb-3"
      onToggle={(e) => {
        playSound('click');
        setOpen(e.currentTarget.open);
      }}
    >
      <summary className="fw-bold py-2 position-relative">
        Filters
        {open && (
          <Button
            size="sm"
            variant="outline-secondary"
            className="position-absolute top-50 end-0 translate-middle-y"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }}
          >
            Clear filters
          </Button>
        )}
      </summary>
      {children}
    </details>
  );
}

export function ListPager({
  page,
  totalPages,
  total,
  noun,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  noun: string;
  onChange: (page: number) => void;
}) {
  return (
    <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
      <Button
        size="sm"
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
      >
        Prev
      </Button>
      <span className="small text-muted">
        Page {page} of {totalPages} ({total} {noun})
      </span>
      <Button
        size="sm"
        variant="secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
