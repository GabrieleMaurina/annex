export const DEFAULT_MAP_NAME = 'Map';
const DEFAULT_NAME_PATTERN = /^Map( \d+)?$/;

export function isDefaultName(name: string): boolean {
  return !name.trim() || DEFAULT_NAME_PATTERN.test(name.trim());
}

export function freeDefaultName(taken: string[]): string {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  let name = DEFAULT_MAP_NAME;
  for (let i = 1; lower.has(name.toLowerCase()); i++)
    name = `${DEFAULT_MAP_NAME} ${i}`;
  return name;
}
