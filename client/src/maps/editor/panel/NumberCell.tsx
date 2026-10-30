import { useNumberInput } from '../../../common/inputs/useNumberInput';
import NumberOdometer from '../../../ui/forms/NumberOdometer';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
}

function NumberCell({ value, min, max, onChange, className }: Props) {
  const numberInput = useNumberInput({ value, min, max, onChange });
  return (
    <NumberOdometer
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
    />
  );
}

export default NumberCell;
