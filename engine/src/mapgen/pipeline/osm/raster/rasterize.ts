const LINE_STEP = 0.5;

export function fillRings(
  target: Uint8Array,
  width: number,
  height: number,
  rings: number[][],
  value: number,
): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings)
    for (let i = 1; i < ring.length; i += 2) {
      minY = Math.min(minY, ring[i]);
      maxY = Math.max(maxY, ring[i]);
    }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(height - 1, Math.ceil(maxY));
  const crossings: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    crossings.length = 0;
    for (const ring of rings) {
      const n = ring.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2];
        const ay = ring[i * 2 + 1];
        const bx = ring[j * 2];
        const by = ring[j * 2 + 1];
        if (ay <= cy === by <= cy) continue;
        crossings.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(crossings[k] - 0.5));
      const x1 = Math.min(width - 1, Math.floor(crossings[k + 1] - 0.5));
      const row = y * width;
      for (let x = x0; x <= x1; x++)
        if (target[row + x] < value) target[row + x] = value;
    }
  }
}

function stamp(
  target: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  value: number,
): void {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  for (let dy = 0; dy <= 1; dy++)
    for (let dx = 0; dx <= 1; dx++) {
      const px = fx + dx;
      const py = fy + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const i = py * width + px;
      if (target[i] < value) target[i] = value;
    }
}

export function extendLine(points: number[], by: number): number[] {
  const n = points.length;
  if (n < 4) return points;
  const stretch = (x: number, y: number, fromX: number, fromY: number) => {
    const length = Math.hypot(x - fromX, y - fromY) || 1;
    return [x + ((x - fromX) / length) * by, y + ((y - fromY) / length) * by];
  };
  return [
    ...stretch(points[0], points[1], points[2], points[3]),
    ...points,
    ...stretch(points[n - 2], points[n - 1], points[n - 4], points[n - 3]),
  ];
}

export function strokeLine(
  target: Uint8Array,
  width: number,
  height: number,
  points: number[],
  value: number,
): void {
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i];
    const ay = points[i + 1];
    const dx = points[i + 2] - ax;
    const dy = points[i + 3] - ay;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / LINE_STEP));
    for (let s = 0; s <= steps; s++)
      stamp(
        target,
        width,
        height,
        ax + (dx * s) / steps,
        ay + (dy * s) / steps,
        value,
      );
  }
}
