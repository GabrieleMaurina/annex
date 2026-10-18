import { Form } from 'react-bootstrap';
import { useNumberInput } from '../../../common/inputs/useNumberInput';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
}

function NumberCell({
  value,
  min,
  max,
  onChange,
  className = 'text-center',
}: Props) {
  const numberInput = useNumberInput({ value, min, max, onChange });
  return (
    <Form.Control
      type="number"
      size="sm"
      className={className}
      min={min}
      max={max}
      value={value}
      onChange={(e) =>
        onChange(
          Math.max(min, Math.min(max, Math.round(Number(e.target.value)))),
        )
      }
      {...numberInput}
      style={numberInput.style}
    />
  );
}

export default NumberCell;
