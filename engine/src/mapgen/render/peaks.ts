const PEAK_WIDTH = 56;
const PEAK_HEIGHT = 44;
const CANDIDATE_STEP = 12;
const MIN_SCALE = 0.45;
const SCALE_STEP = 0.1;
const SIZE_SPREAD = 0.3;
const SPACING = 0.65;
const SNOW_SHARE = 0.4;

export interface PeakColors {
  rock: number;
  rockShade: number;
  snow: number;
  snowShade: number;
}

interface Peak {
  x: number;
  y: number;
  scale: number;
}

function noise(x: number, y: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function placePeaks(
  inside: (x: number, y: number) => boolean,
  width: number,
  height: number,
): Peak[] {
  const candidates: Peak[] = [];
  for (let y = 0; y < height; y += CANDIDATE_STEP)
    for (let x = 0; x < width; x += CANDIDATE_STEP)
      candidates.push({
        x: Math.round(x + noise(x, y, 1) * CANDIDATE_STEP),
        y: Math.round(y + noise(x, y, 2) * CANDIDATE_STEP),
        scale: 1 + (noise(x, y, 3) - 0.5) * SIZE_SPREAD,
      });
  candidates.sort((a, b) => noise(a.x, a.y, 4) - noise(b.x, b.y, 4));
  const bucket = PEAK_WIDTH;
  const placed = new Map<string, Peak[]>();
  const peaks: Peak[] = [];
  const fits = ({ x, y }: Peak, scale: number) => {
    const half = Math.round((PEAK_WIDTH * scale) / 2);
    const top = y - Math.round(PEAK_HEIGHT * scale);
    return (
      inside(x, y) &&
      inside(x - half, y) &&
      inside(x + half, y) &&
      inside(x, top) &&
      inside(x, Math.round((y + top) / 2))
    );
  };
  const crowded = ({ x, y }: Peak, scale: number) => {
    const bx = Math.floor(x / bucket);
    const by = Math.floor(y / bucket);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const other of placed.get(`${bx + dx}:${by + dy}`) ?? [])
          if (
            Math.hypot(other.x - x, (other.y - y) * 1.5) <
            SPACING * PEAK_WIDTH * ((scale + other.scale) / 2)
          )
            return true;
    return false;
  };
  for (const candidate of candidates) {
    let scale = candidate.scale;
    while (scale >= MIN_SCALE && !fits(candidate, scale)) scale -= SCALE_STEP;
    if (scale < MIN_SCALE || crowded(candidate, scale)) continue;
    const peak = { ...candidate, scale };
    const key = `${Math.floor(peak.x / bucket)}:${Math.floor(peak.y / bucket)}`;
    placed.set(key, [...(placed.get(key) ?? []), peak]);
    peaks.push(peak);
  }
  return peaks.sort((a, b) => a.y - b.y);
}

export function drawPeaks(
  indices: Uint8Array,
  inBand: (i: number) => boolean,
  snowy: (i: number) => boolean,
  width: number,
  height: number,
  colors: PeakColors,
): void {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && inBand(y * width + x);
  for (const { x: baseX, y: baseY, scale } of placePeaks(
    inside,
    width,
    height,
  )) {
    const peak = Math.round(PEAK_HEIGHT * scale);
    const half = (PEAK_WIDTH * scale) / 2;
    const capped = snowy((baseY - Math.round(peak / 2)) * width + baseX);
    for (let dy = 0; dy <= peak; dy++) {
      const y = baseY - peak + dy;
      const reach = (dy / peak) * half;
      const snow = capped && dy < peak * SNOW_SHARE;
      for (let x = Math.ceil(baseX - reach); x <= baseX + reach; x++) {
        if (!inside(x, y)) continue;
        const shaded = x > baseX;
        indices[y * width + x] = snow
          ? shaded
            ? colors.snowShade
            : colors.snow
          : shaded
            ? colors.rockShade
            : colors.rock;
      }
    }
  }
}
