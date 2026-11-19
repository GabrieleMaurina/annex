const PAIR_BASE = 65536;

export function pairKey(a: number, b: number): number {
  return Math.min(a, b) * PAIR_BASE + Math.max(a, b);
}

export function discOffsets(radius: number): [number, number][] {
  const offsets: [number, number][] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
  return offsets;
}
