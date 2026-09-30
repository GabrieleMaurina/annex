import countries from 'flag-icons/country.json';
import { TIME_ZONE_COUNTRIES } from './timeZones';

const flagFiles = import.meta.glob<string>(
  '../../../../node_modules/flag-icons/flags/4x3/*.svg',
  { query: '?no-inline', import: 'default', eager: true },
);

const flagUrls = new Map(
  Object.entries(flagFiles).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.svg'.length),
    url,
  ]),
);

const countryNames = new Map(
  countries.map((country) => [country.code, country.name]),
);

export const UNKNOWN_COUNTRY = 'xx';

export const COUNTRIES = countries
  .filter((country) => country.code !== UNKNOWN_COUNTRY)
  .map((country) => ({ code: country.code, name: country.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function flagUrl(code: string): string | undefined {
  return flagUrls.get(code);
}

export function guessCountry(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TIME_ZONE_COUNTRIES[timeZone] ?? '';
}

export function countryName(code: string): string {
  return countryNames.get(code) ?? code;
}
