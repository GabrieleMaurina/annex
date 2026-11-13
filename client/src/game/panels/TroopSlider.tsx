import type { ChangeEvent } from 'react';
import { Form } from 'react-bootstrap';
import { playSound } from '../../lib/sounds';

interface Props {
  min: number;
  max: number;
  value: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function TroopSlider({ min, max, value, onChange }: Props) {
  return (
    <Form.Range
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      onPointerUp={() => playSound('click')}
      disabled={min >= max}
    />
  );
}

export default TroopSlider;
