import Tip from '../tooltips/Tip';
import { countryName, flagUrl } from './countries';

function Flag({
  country,
  height = 15,
}: {
  country: string | null | undefined;
  height?: number;
}) {
  if (!country) return null;
  const name = countryName(country);
  return (
    <Tip text={name}>
      <img
        src={flagUrl(country)}
        width={(height * 4) / 3}
        height={height}
        alt={name}
        className="flex-shrink-0 align-middle"
      />
    </Tip>
  );
}

export default Flag;
