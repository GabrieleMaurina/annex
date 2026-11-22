export function lowerIndex(sorted: number[], target: number): number {
  let low = 0;
  let high = Math.max(0, sorted.length - 2);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (sorted[middle] <= target) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function lineAt(
  sorted: number[],
  values: number[],
  target: number,
): number {
  if (sorted.length < 2) return values[0];
  const low = lowerIndex(sorted, target);
  const span = sorted[low + 1] - sorted[low];
  const t = span > 0 ? (target - sorted[low]) / span : 0;
  return (
    values[low] + Math.min(1, Math.max(0, t)) * (values[low + 1] - values[low])
  );
}

export function nearestIndex(sorted: number[], target: number): number {
  const low = lowerIndex(sorted, target);
  const next = Math.min(sorted.length - 1, low + 1);
  return Math.abs(sorted[next] - target) < Math.abs(sorted[low] - target)
    ? next
    : low;
}
