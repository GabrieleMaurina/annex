import { GAME_ENUMS, SETTINGS_ENUM_KEYS } from '../db';

const SETTING_KEYS = SETTINGS_ENUM_KEYS.filter((k) => k !== 'gameMode');

export function intParam(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function optIntParam(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function timeParam(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const time = Number(value);
  return Number.isFinite(time) ? time : undefined;
}

export function stringArrayParam(
  value: unknown,
  max: number,
): string[] | undefined {
  const raw = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  const ids = raw.filter(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  );
  return ids.length > 0 ? ids.slice(0, max) : undefined;
}

export function parseSettings(
  q: Record<string, unknown>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const key of SETTING_KEYS) {
    const raw = q[key];
    if (typeof raw !== 'string' || raw === '') continue;
    const values = GAME_ENUMS[key];
    if (values.includes(raw)) out[key] = raw;
    else if (values.includes(Number(raw))) out[key] = Number(raw);
  }
  return out;
}
