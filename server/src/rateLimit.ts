interface Counter {
  count: number;
  resetAt: number;
}

const authAttempts = new Map<string, Counter>();
const loginFailures = new Map<string, Counter>();

const AUTH_MAX = 30;
const AUTH_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_FAILURE_MAX = 8;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

function hit(
  store: Map<string, Counter>,
  key: string,
  windowMs: number,
): number {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

export function allowAuthAttempt(ip: string): boolean {
  return hit(authAttempts, ip, AUTH_WINDOW_MS) <= AUTH_MAX;
}

export function loginLockedOut(username: string): boolean {
  const entry = loginFailures.get(username.toLowerCase());
  return (
    !!entry && Date.now() < entry.resetAt && entry.count >= LOGIN_FAILURE_MAX
  );
}

export function recordLoginFailure(username: string): void {
  hit(loginFailures, username.toLowerCase(), LOGIN_FAILURE_WINDOW_MS);
}

export function clearLoginFailures(username: string): void {
  loginFailures.delete(username.toLowerCase());
}

setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of authAttempts)
      if (now >= entry.resetAt) authAttempts.delete(key);
    for (const [key, entry] of loginFailures)
      if (now >= entry.resetAt) loginFailures.delete(key);
  },
  10 * 60 * 1000,
).unref();
