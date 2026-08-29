import { Server, Socket } from 'socket.io';
import { gameRoomName } from './rooms';

export type GameVisibility = 'public' | 'private';

interface GameMeta {
  password: string | null;
  visibility: GameVisibility;
}

const MAX_PASSWORD_LENGTH = 50;
const DEFAULT_META: GameMeta = { password: null, visibility: 'public' };

const metaByGame = new Map<string, GameMeta>();
const exemptByGame = new Map<string, Set<number>>();

export function createGameMeta(name: string, hostId: number): void {
  metaByGame.set(name, { ...DEFAULT_META });
  exemptByGame.set(name, new Set([hostId]));
}

export function getGameMeta(name: string): GameMeta {
  return metaByGame.get(name) ?? DEFAULT_META;
}

export function isGamePublic(name: string): boolean {
  return getGameMeta(name).visibility === 'public';
}

export function renameGameMeta(from: string, to: string): void {
  const meta = metaByGame.get(from);
  if (meta) {
    metaByGame.delete(from);
    metaByGame.set(to, meta);
  }
  const exempt = exemptByGame.get(from);
  if (exempt) {
    exemptByGame.delete(from);
    exemptByGame.set(to, exempt);
  }
}

export function reconcileGameMeta(existing: Set<string>): void {
  for (const name of [...metaByGame.keys()]) {
    if (existing.has(name)) continue;
    metaByGame.delete(name);
    exemptByGame.delete(name);
  }
}

export function checkGamePassword(
  name: string,
  playerId: number,
  password: unknown,
): boolean {
  const meta = metaByGame.get(name);
  if (!meta || meta.password === null) return true;
  if (exemptByGame.get(name)?.has(playerId)) return true;
  return password === meta.password;
}

export function grantGamePasswordExempt(name: string, playerId: number): void {
  let set = exemptByGame.get(name);
  if (!set) {
    set = new Set();
    exemptByGame.set(name, set);
  }
  set.add(playerId);
}

export type MetaUpdate = {
  password?: string | null;
  visibility?: GameVisibility;
};

export function parseMetaSettings(
  settings: Record<string, unknown>,
): MetaUpdate | { error: string } {
  const update: MetaUpdate = {};
  if ('password' in settings) {
    const value = settings.password;
    if (value === null) update.password = null;
    else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > MAX_PASSWORD_LENGTH)
        return { error: 'invalid password' };
      update.password = trimmed;
    } else return { error: 'invalid password' };
  }
  if ('visibility' in settings) {
    const value = settings.visibility;
    if (value === 'public' || value === 'private') update.visibility = value;
    else return { error: 'invalid visibility' };
  }
  return update;
}

export function applyMetaUpdate(name: string, update: MetaUpdate): void {
  const meta = metaByGame.get(name);
  if (!meta) return;
  if (update.password !== undefined) meta.password = update.password;
  if (update.visibility !== undefined) meta.visibility = update.visibility;
}

export function emitGameMeta(io: Server, name: string, socket?: Socket): void {
  const meta = getGameMeta(name);
  const payload = {
    hasPassword: meta.password !== null,
    visibility: meta.visibility,
  };
  if (socket) socket.emit('game:meta', payload);
  else io.to(gameRoomName(name)).emit('game:meta', payload);
}
