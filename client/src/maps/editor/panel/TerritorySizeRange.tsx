import { Form } from 'react-bootstrap';

const MIN_CELL_SCALE = 0.5;
const MAX_CELL_SCALE = 4;
const CELL_SCALE_STEP = 0.25;

function TerritorySizeRange({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="d-flex align-items-center gap-2 mb-2">
      <Form.Label className="small text-nowrap mb-0">
        Max territory size
      </Form.Label>
      <Form.Range
        min={MIN_CELL_SCALE}
        max={MAX_CELL_SCALE}
        step={CELL_SCALE_STEP}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="small text-muted text-nowrap">{value}×</span>
    </div>
  );
}

export default TerritorySizeRange;
