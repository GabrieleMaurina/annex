import { hash, verify } from 'argon2';

const MAX_CONCURRENT = 4;
let active = 0;
const waiters: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) next();
  else active -= 1;
}

export function hashPassword(password: string): Promise<string> {
  return acquire().then(() => hash(password).finally(release));
}

export function verifyPassword(
  hashed: string,
  password: string,
): Promise<boolean> {
  return acquire().then(() => verify(hashed, password).finally(release));
}
