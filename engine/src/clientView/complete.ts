export type Complete<T> = { [K in keyof Required<T>]: T[K] };

export function complete<T>(value: Complete<T>): T {
  return value as T;
}
