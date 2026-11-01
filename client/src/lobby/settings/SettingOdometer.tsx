import { useNumberInput } from '../../common/inputs/useNumberInput';
import NumberOdometer from '../../ui/forms/NumberOdometer';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function SettingOdometer({ value, min, max, onChange, className }: Props) {
  const numberInput = useNumberInput({ value, min, max, onChange });

  function commit(input: HTMLInputElement) {
    if (input.value === '') return;
    const next = clamp(Number(input.value), min, max);
    if (next !== value) onChange(next);
  }

  return (
    <NumberOdometer
      className={className}
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        if (!(e.nativeEvent as InputEvent).inputType)
          onChange(clamp(Number(e.target.value), min, max));
      }}
      onBlur={(e) => commit(e.currentTarget)}
      {...numberInput}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        numberInput.onKeyDown(e);
      }}
    />
  );
}

export default SettingOdometer;
