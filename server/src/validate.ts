export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

export function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}
