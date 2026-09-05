import { createHash, randomBytes } from 'crypto';
import { containsProfanity } from 'engine';
import {
  ClientSettings,
  GameSettings,
  consumeEmailConfirmation,
  consumePasswordReset,
  createEmailConfirmation,
  createPasswordReset,
  deleteSession,
  deleteUserSessions,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  insertUser,
  markEmailValidated,
  saveSettings,
  setPassword,
  touchSession,
  upsertSession,
} from './db';
import { sendEmail } from './email';
import { hashPassword, verifyPassword } from './password';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5000';

export {
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  normalizeEmail,
} from './db';
export type { ClientSettings, GameSettings };

export interface SessionInfo {
  userId: string;
  username: string;
  elo: number;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
}

export type LoginResult =
  | {
      ok: true;
      userId: string;
      username: string;
      clientSettings: ClientSettings;
      gameSettings: GameSettings;
    }
  | { ok: false; error: string };

export function randomToken(): string {
  return randomBytes(32).toString('hex');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isValidUsername(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9]{3,10}$/.test(value) &&
    !containsProfanity(value)
  );
}

function isValidEmail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 50 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

function sendMail(to: string, subject: string, html: string): Promise<void> {
  const body = `<p><img src="${CLIENT_URL}/favicon.svg" alt="Annex" width="48" height="48" /></p>${html}`;
  return new Promise((resolve, reject) => {
    sendEmail(to, subject, body, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

function sendConfirmation(userId: string, email: string): Promise<void> {
  const code = randomToken();
  return createEmailConfirmation(userId, sha256(code)).then(() => {
    const link = `${CLIENT_URL}/email_confirmation/${code}`;
    return sendMail(
      email,
      'Confirm your Annex account',
      `<p>Confirm your email address:</p><p><a href="${link}">${link}</a></p>`,
    );
  });
}

function sendReset(userId: string, email: string): Promise<void> {
  const code = randomToken();
  return createPasswordReset(userId, sha256(code)).then(() => {
    const link = `${CLIENT_URL}/password_reset/${code}`;
    return sendMail(
      email,
      'Reset your Annex password',
      `<p>Reset your password:</p><p><a href="${link}">${link}</a></p>`,
    );
  });
}

function loginResult(user: {
  id: string;
  username: string;
  clientSettings: ClientSettings;
  gameSettings: GameSettings;
}): LoginResult {
  return {
    ok: true,
    userId: user.id,
    username: user.username,
    clientSettings: user.clientSettings,
    gameSettings: user.gameSettings,
  };
}

export function registerAccount(data: {
  username: unknown;
  email: unknown;
  password: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { username, email, password } = data;
  if (!isValidUsername(username))
    return Promise.resolve({ ok: false, error: 'invalid username' });
  if (!isValidEmail(email))
    return Promise.resolve({ ok: false, error: 'invalid email' });
  if (!isValidPassword(password))
    return Promise.resolve({ ok: false, error: 'invalid password' });

  return findUserByUsername(username).then((byUsername) => {
    if (byUsername)
      return { ok: false as const, error: 'username already taken' };
    return findUserByEmail(email).then((byEmail) => {
      if (byEmail)
        return sendMail(
          byEmail.email,
          'You already have an Annex account',
          `<p>Someone tried to create an Annex account with this email address, but one already exists. If this was you, just log in. If it wasn't, you can ignore this email.</p>`,
        ).then(() => ({ ok: true as const }));
      return hashPassword(password)
        .then((passwordHash) => insertUser({ username, email, passwordHash }))
        .then((res) => {
          if ('duplicate' in res)
            return { ok: false as const, error: 'username already taken' };
          return sendConfirmation(res.id, email).then(() => ({
            ok: true as const,
          }));
        });
    });
  });
}

export function confirmEmail(
  code: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof code !== 'string' || !code)
    return Promise.resolve({ ok: false, error: 'invalid code' });
  return consumeEmailConfirmation(sha256(code)).then((userId) => {
    if (!userId)
      return { ok: false as const, error: 'invalid or expired code' };
    return markEmailValidated(userId).then(() => ({ ok: true as const }));
  });
}

export function requestPasswordReset(email: unknown): Promise<{ ok: true }> {
  if (typeof email !== 'string' || !email) return Promise.resolve({ ok: true });
  return findUserByEmail(email).then((user) => {
    if (!user) return { ok: true as const };
    return sendReset(user.id, user.email).then(() => ({ ok: true as const }));
  });
}

export function resetPassword(
  code: unknown,
  password: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof code !== 'string' || !code)
    return Promise.resolve({ ok: false, error: 'invalid code' });
  if (!isValidPassword(password))
    return Promise.resolve({ ok: false, error: 'invalid password' });
  return consumePasswordReset(sha256(code)).then((userId) => {
    if (!userId)
      return { ok: false as const, error: 'invalid or expired code' };
    return hashPassword(password)
      .then((hash) => setPassword(userId, hash))
      .then(() => markEmailValidated(userId))
      .then(() => deleteUserSessions(userId))
      .then(() => ({ ok: true as const }));
  });
}

let dummyHash: Promise<string> | null = null;

function decoyVerify(password: string): Promise<boolean> {
  if (!dummyHash) dummyHash = hashPassword(randomToken());
  return dummyHash.then((hash) => verifyPassword(hash, password));
}

export function login(data: {
  email: unknown;
  password: unknown;
}): Promise<LoginResult> {
  const { email, password } = data;
  if (typeof email !== 'string' || typeof password !== 'string')
    return Promise.resolve({ ok: false, error: 'invalid credentials' });
  return findUserByEmail(email).then((user) => {
    if (!user)
      return decoyVerify(password).then(() => ({
        ok: false as const,
        error: 'invalid credentials',
      }));
    return verifyPassword(user.passwordHash, password).then((valid) => {
      if (!valid) return { ok: false as const, error: 'invalid credentials' };
      if (!user.emailValidated)
        return sendConfirmation(user.id, user.email).then(() => ({
          ok: false as const,
          error: 'email not confirmed',
        }));
      return loginResult(user);
    });
  });
}

export function resolveSession(token: string): Promise<SessionInfo | null> {
  return touchSession(sha256(token)).then((userId) => {
    if (!userId) return null;
    return findUserById(userId).then((user) =>
      user
        ? {
            userId: user.id,
            username: user.username,
            elo: user.elo,
            clientSettings: user.clientSettings,
            gameSettings: user.gameSettings,
          }
        : null,
    );
  });
}

export function attachSession(token: string, userId: string): Promise<void> {
  return upsertSession(sha256(token), userId);
}

export function destroySession(token: string): Promise<void> {
  return deleteSession(sha256(token));
}

export function updateUserSettings(
  userId: string,
  patch: { clientSettings?: unknown; gameSettings?: unknown },
): Promise<void> {
  return saveSettings(userId, patch);
}
