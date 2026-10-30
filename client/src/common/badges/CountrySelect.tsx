import Selector from '../../ui/forms/Selector';
import { COUNTRIES, UNKNOWN_COUNTRY } from './countries';
import Flag from './Flag';

function CountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (country: string) => void;
}) {
  const selected = value === UNKNOWN_COUNTRY ? '' : value;
  return (
    <div className="d-flex align-items-center gap-2">
      <Flag country={selected} />
      <Selector
        size="sm"
        aria-label="Country"
        value={selected}
        onChange={onChange}
      >
        <option value="" disabled>
          Select your country
        </option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Selector>
    </div>
  );
}

export default CountrySelect;
