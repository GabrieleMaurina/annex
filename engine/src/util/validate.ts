export function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

export function isNullableInteger(value: unknown): value is number | null {
  return value === null || Number.isInteger(value);
}
