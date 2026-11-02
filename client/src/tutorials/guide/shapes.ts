export function loopPath(
  cx: number,
  cy: number,
  radii: number[],
  scale = 1,
): string {
  const ring = radii.map((r, i) => {
    const angle = (Math.PI * 2 * i) / radii.length;
    return [cx + r * scale * Math.cos(angle), cy + r * scale * Math.sin(angle)];
  });
  const at = (i: number) => ring[(i + ring.length) % ring.length];
  const segments = ring.map((_, i) => {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  });
  return `M${ring[0][0]},${ring[0][1]} ${segments.join(' ')} Z`;
}

export function hexagonPoints(cx: number, cy: number, radius: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(' ');
}
