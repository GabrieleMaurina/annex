import countries from 'flag-icons/country.json';

export const UNKNOWN_COUNTRY = 'xx';

export const COUNTRY_CODES = [
  UNKNOWN_COUNTRY,
  ...countries
    .map((country) => country.code)
    .filter((code) => code !== UNKNOWN_COUNTRY),
];

export function isSelectableCountry(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== UNKNOWN_COUNTRY &&
    COUNTRY_CODES.includes(value)
  );
}
