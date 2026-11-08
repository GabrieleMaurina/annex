import { replayStops, type ReplayData } from '../replay';

export type ClipDensity = 'moves' | 'turns' | 'rounds';
export type ClipFormat = 'gif' | 'mp4';

export const MAX_CLIP_FRAMES = 1000;
const DURATION_PRESETS = [2, 3, 5, 10, 15, 30, 60, 120, 300, 600];
const DEFAULT_MAX_SECONDS = 17;
const MIN_SUGGESTED_SECONDS = 3;
const MAX_SUGGESTED_SECONDS = 60;
const DURATION_BASE_SECONDS = 2;
const DURATION_SECONDS_PER_ROOT_FRAME = 1.2;
export const ANIMATION_WINDOW_MS = 3500;
const SUBFRAME_MS: Record<ClipFormat, number> = { gif: 80, mp4: 33 };
const MAX_SUBFRAMES: Record<ClipFormat, number> = { gif: 1200, mp4: 4000 };
const MAX_HOLD_MS = 2000;
const MIN_HOLD_MS = 500;
const HOLD_SHARE = 0.15;
const MIN_FRAME_MS: Record<ClipFormat, number> = { gif: 40, mp4: 20 };

export function clipIndices(
  replay: ReplayData,
  start: number,
  end: number,
  density: ClipDensity,
): number[] {
  if (density === 'moves')
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const { turnStops, roundStops } = replayStops(replay.frames);
  const stops = density === 'turns' ? turnStops : roundStops;
  const inner = stops
    .map((stop) => stop - 1)
    .filter((i) => i > start && i < end);
  return [start, ...inner, end];
}

export const SUGGESTED_DENSITY: ClipDensity = 'moves';

export function defaultDuration(
  replay: ReplayData,
  start: number,
  end: number,
): number {
  const frameCount = clipIndices(replay, start, end, SUGGESTED_DENSITY).length;
  return Math.min(DEFAULT_MAX_SECONDS, suggestedDuration(frameCount));
}

export function suggestedDuration(frameCount: number): number {
  return Math.min(
    MAX_SUGGESTED_SECONDS,
    Math.max(
      MIN_SUGGESTED_SECONDS,
      Math.round(
        DURATION_BASE_SECONDS +
          DURATION_SECONDS_PER_ROOT_FRAME * Math.sqrt(frameCount),
      ),
    ),
  );
}

export function suggestedFormat(mp4Supported: boolean): ClipFormat {
  return mp4Supported ? 'mp4' : 'gif';
}

interface Subframe {
  position: number;
  offset: number;
  duration: number;
}

export function planSubframes(
  durations: number[],
  format: ClipFormat,
  animate: boolean,
  cardPosition: number,
): Subframe[] {
  const windows = durations.map((d, position) =>
    animate || position === cardPosition ? Math.min(d, ANIMATION_WINDOW_MS) : 0,
  );
  const totalWindow = windows.reduce((sum, w) => sum + w, 0);
  const interval = Math.max(
    SUBFRAME_MS[format],
    totalWindow / MAX_SUBFRAMES[format],
  );
  return durations.flatMap((duration, position) => {
    if (windows[position] === 0) return [{ position, offset: 0, duration }];
    const count = Math.max(1, Math.round(windows[position] / interval));
    const each = windows[position] / count;
    return Array.from({ length: count }, (_, i) => ({
      position,
      offset: i * each,
      duration: i === count - 1 ? duration - each * (count - 1) : each,
    }));
  });
}

export function durationOptions(
  frameCount: number,
  format: ClipFormat,
  keep: number[],
): number[] {
  const minimum =
    ((frameCount - 1) * MIN_FRAME_MS[format] + MIN_HOLD_MS) / 1000;
  const presets = DURATION_PRESETS.filter((seconds) => seconds >= minimum);
  return [...new Set([...presets, ...keep])].sort((a, b) => a - b);
}

export function frameDurations(
  frameCount: number,
  durationSeconds: number,
  format: ClipFormat,
): number[] {
  const total = durationSeconds * 1000;
  if (frameCount <= 1) return [total];
  const hold = Math.max(MIN_HOLD_MS, Math.min(MAX_HOLD_MS, total * HOLD_SHARE));
  const interval = Math.max(
    MIN_FRAME_MS[format],
    (total - hold) / (frameCount - 1),
  );
  return Array.from({ length: frameCount }, (_, i) =>
    i === frameCount - 1 ? hold : interval,
  );
}

export function roundAt(replay: ReplayData, index: number): number {
  const frame = index <= 0 ? replay.frames[0] : replay.frames[index - 1];
  return frame?.roundNumber ?? 0;
}
