import { IncomingHttpHeaders, IncomingMessage } from 'http';

export const SESSION_COOKIE = 'anx';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

export function isSessionToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

export function parseCookies(
  header: string | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function serializeSessionCookie(value: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function trustedProxyHops(): number {
  const value = Number(process.env.TRUST_PROXY_HOPS);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function forwardedEntry(
  header: string | string[] | undefined,
  hops: number,
): string | undefined {
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (!raw) return undefined;
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries[entries.length - hops];
}

export function clientIp(
  headers: IncomingHttpHeaders,
  directAddress: string,
): string {
  const hops = trustedProxyHops();
  if (hops === 0) return directAddress;
  return forwardedEntry(headers['x-forwarded-for'], hops) || directAddress;
}

export function isSecureRequest(req: IncomingMessage): boolean {
  if ((req.socket as { encrypted?: boolean }).encrypted === true) return true;
  const hops = trustedProxyHops();
  if (hops === 0) return false;
  return forwardedEntry(req.headers['x-forwarded-proto'], hops) === 'https';
}

export function sessionTokenFromRequest(req: IncomingMessage): string {
  const stashed = (req as { anxToken?: string }).anxToken;
  if (isSessionToken(stashed)) return stashed;
  const raw = parseCookies(req.headers.cookie).anx;
  return isSessionToken(raw) ? raw : '';
}

const ROTATION_TTL_MS = 5 * 60 * 1000;
const pendingRotations = new Map<string, string>();

export function queueSessionRotation(current: string, next: string): void {
  pendingRotations.set(current, next);
  setTimeout(() => {
    if (pendingRotations.get(current) === next)
      pendingRotations.delete(current);
  }, ROTATION_TTL_MS).unref();
}

export function takeSessionRotation(current: string): string | undefined {
  const next = pendingRotations.get(current);
  if (next !== undefined) pendingRotations.delete(current);
  return next;
}
