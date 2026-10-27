import { isValidPlaceName, MAX_PLACE_NAME_LENGTH } from 'engine';
import { Form } from 'react-bootstrap';

interface Props {
  value: string;
  placeholder: string;
  duplicate: boolean;
  onChange: (value: string) => void;
}

function PlaceNameInput({ value, placeholder, duplicate, onChange }: Props) {
  return (
    <Form.Control
      size="sm"
      value={value}
      placeholder={placeholder}
      maxLength={MAX_PLACE_NAME_LENGTH}
      isInvalid={duplicate || !isValidPlaceName(value.trim())}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default PlaceNameInput;
