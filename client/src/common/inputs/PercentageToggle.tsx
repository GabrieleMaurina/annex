import { useId } from 'react';
import { Form } from 'react-bootstrap';
import { saveTroopsPercentage } from '../../lib/player';
import { playSound } from '../../lib/sounds';
import { canUsePercentage, useTroopsPercentage } from './useTroopsInput';

function PercentageToggle({ max }: { max: number }) {
  const id = useId();
  const percentage = useTroopsPercentage();
  if (!canUsePercentage(max)) return null;
  return (
    <Form.Check
      type="switch"
      id={id}
      label="Percentage"
      className="small mb-0"
      checked={percentage}
      onChange={(e) => {
        playSound('click');
        e.currentTarget.blur();
        saveTroopsPercentage(e.currentTarget.checked);
      }}
    />
  );
}

export default PercentageToggle;
