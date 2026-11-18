import { randomBytes, randomInt } from 'crypto';
import { Engine } from 'engine';
import { ObjectId } from 'mongodb';
import { loadBlockPeers } from '../conduct/blockPeers';
import {
  areFriends,
  findUserById,
  FriendSummary,
  getFriendsOverview,
} from '../db';
import { isLive } from '../http/presence';
import { playerIdByUserId } from '../sockets/socketRooms';

export type InviteKind = 'challenge' | 'invite';

interface Invite {
  id: string;
  kind: InviteKind;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  gameName: string;
  newGame: boolean;
  accepted: boolean;
  created: boolean;
  acceptedAt: number;
}

interface Failure {
  ok: false;
  error: string;
}

const ACCEPTED_TTL_MS = 60 * 1000;

const invites = new Map<string, Invite>();
let engine: Engine | null = null;

export function setInvitesEngine(value: Engine): void {
  engine = value;
}

function fail(error: string): Failure {
  return { ok: false, error };
}

function gameOf(userId: string): string | null {
  const playerId = playerIdByUserId.get(userId);
  return playerId === undefined || !engine
    ? null
    : engine.playerGameName(playerId);
}

function summaries() {
  return engine ? engine.listGameSummaries() : [];
}

function openLobbyOf(
  userId: string,
  games: ReturnType<typeof summaries>,
): string | null {
  const name = gameOf(userId);
  const game = games.find((g) => g.name === name);
  return game &&
    game.state === 'lobby' &&
    game.settings.gameType === 'casual' &&
    game.playerCount < game.slots
    ? game.name
    : null;
}

function stillValid(
  invite: Invite,
  games: ReturnType<typeof summaries>,
): boolean {
  if (invite.accepted) return Date.now() - invite.acceptedAt < ACCEPTED_TTL_MS;
  if (!isLive(invite.fromUserId) || !isLive(invite.toUserId)) return false;
  if (gameOf(invite.toUserId) !== null) return false;
  return invite.newGame
    ? gameOf(invite.fromUserId) === null
    : openLobbyOf(invite.fromUserId, games) === invite.gameName;
}

function prune(): void {
  const games = [...invites.values()].some((i) => !i.newGame && !i.accepted)
    ? summaries()
    : [];
  for (const [id, invite] of invites)
    if (!stillValid(invite, games)) invites.delete(id);
}

function freshGameName(kind: InviteKind): string {
  const taken = new Set([
    ...summaries().map((g) => g.name),
    ...[...invites.values()].map((i) => i.gameName),
  ]);
  const base = kind === 'challenge' ? 'Challenge' : 'Friendly';
  let name = '';
  do name = `${base} ${randomInt(1000, 10000)}`;
  while (taken.has(name));
  return name;
}

export function canReceiveInvite(userId: string): boolean {
  return isLive(userId) && gameOf(userId) === null;
}

function rejectionOf(
  fromUserId: string,
  toUserId: string,
  kind: InviteKind,
  lobby: boolean,
  lobbyName: string | null,
): string | null {
  if (fromUserId === toUserId) return 'cannot invite yourself';
  if (!ObjectId.isValid(toUserId)) return 'user not found';
  if (lobby && kind !== 'invite') return 'invalid invite';
  if (lobby && !lobbyName) return 'game not open';
  if (!lobby && gameOf(fromUserId) !== null) return 'already in a game';
  if (!isLive(toUserId)) return 'player offline';
  if (gameOf(toUserId) !== null) return 'player is in a game';
  return null;
}

export function createInvite(
  from: { userId: string; name: string },
  toUserId: string,
  kind: InviteKind,
  lobby: boolean,
): Promise<{ ok: true; id: string } | Failure> {
  prune();
  const lobbyName = lobby ? openLobbyOf(from.userId, summaries()) : null;
  const rejection = rejectionOf(from.userId, toUserId, kind, lobby, lobbyName);
  if (rejection) return Promise.resolve(fail(rejection));

  return Promise.all([
    findUserById(toUserId),
    loadBlockPeers(from.userId),
    kind === 'invite' ? areFriends(from.userId, toUserId) : true,
  ]).then(([user, peers, friends]) => {
    if (!user) return fail('user not found');
    if (peers.all.has(toUserId)) return fail('blocked');
    if (!friends) return fail('not friends');
    for (const [id, invite] of invites)
      if (
        !invite.accepted &&
        invite.fromUserId === from.userId &&
        (invite.toUserId === toUserId || (!lobby && invite.newGame))
      )
        invites.delete(id);
    const invite: Invite = {
      id: randomBytes(8).toString('hex'),
      kind,
      fromUserId: from.userId,
      fromName: from.name,
      toUserId,
      toName: user.username,
      gameName: lobbyName ?? freshGameName(kind),
      newGame: !lobby,
      accepted: false,
      created: lobby,
      acceptedAt: 0,
    };
    invites.set(invite.id, invite);
    return { ok: true as const, id: invite.id };
  });
}

export function listInvites(userId: string) {
  prune();
  const all = [...invites.values()];
  return {
    incoming: all
      .filter((i) => i.toUserId === userId)
      .map((i) => ({
        id: i.id,
        kind: i.kind,
        fromUserId: i.fromUserId,
        fromName: i.fromName,
        gameName: i.gameName,
        newGame: i.newGame,
        accepted: i.accepted,
        ready: i.created,
      })),
    outgoing: all
      .filter((i) => i.fromUserId === userId && (i.newGame || !i.accepted))
      .map((i) => ({
        id: i.id,
        kind: i.kind,
        toUserId: i.toUserId,
        toName: i.toName,
        gameName: i.gameName,
        newGame: i.newGame,
        accepted: i.accepted,
        ready: i.created,
      })),
  };
}

export function respondToInvite(
  userId: string,
  id: string,
  accept: boolean,
): { ok: true } | Failure {
  prune();
  const invite = invites.get(id);
  if (!invite || invite.toUserId !== userId || invite.accepted)
    return fail('invite expired');
  if (!accept) {
    invites.delete(id);
    return { ok: true };
  }
  for (const [otherId, other] of invites)
    if (other.toUserId === userId && other !== invite) invites.delete(otherId);
  invite.accepted = true;
  invite.acceptedAt = Date.now();
  return { ok: true };
}

export function cancelInvite(userId: string, id: string): void {
  const invite = invites.get(id);
  if (invite && invite.fromUserId === userId && !invite.accepted)
    invites.delete(id);
}

export function invitableFriends(userId: string): Promise<FriendSummary[]> {
  return getFriendsOverview(userId).then((overview) =>
    overview.friends.filter(
      (friend) => isLive(friend.id) && gameOf(friend.id) === null,
    ),
  );
}

function reservation(gameName: string): Invite | undefined {
  for (const invite of invites.values())
    if (invite.newGame && invite.gameName === gameName) return invite;
  return undefined;
}

export function canCreateGame(
  gameName: string,
  userId: string | undefined,
): boolean {
  const held = reservation(gameName);
  return !held || held.fromUserId === userId;
}

export function gameCreated(gameName: string, userId: string): void {
  const held = reservation(gameName);
  if (held && held.fromUserId === userId) held.created = true;
}

export function canJoinGame(
  gameName: string,
  userId: string | undefined,
): boolean {
  const held = reservation(gameName);
  return (
    !held ||
    held.fromUserId === userId ||
    (held.toUserId === userId && held.accepted)
  );
}

export function hasInvitesFor(gameName: string): boolean {
  for (const invite of invites.values())
    if (invite.gameName === gameName) return true;
  return false;
}

export function renameError(
  currentName: string,
  newName: string,
): string | null {
  if (reservation(newName)) return 'game name already in use';
  return hasInvitesFor(currentName) ? 'game has pending invites' : null;
}

export function isInvitedTo(gameName: string, userId: string): boolean {
  for (const invite of invites.values())
    if (
      invite.accepted &&
      invite.toUserId === userId &&
      invite.gameName === gameName
    )
      return true;
  return false;
}

export function gameJoined(gameName: string, userId: string): void {
  for (const [id, invite] of invites)
    if (
      invite.accepted &&
      invite.toUserId === userId &&
      invite.gameName === gameName
    )
      invites.delete(id);
}
