import { Engine, isActorAnonymous, toClient } from 'engine';
import { ObjectId } from 'mongodb';
import { Server } from 'socket.io';
import {
  countBlocks,
  deleteBlock,
  findUserById,
  getBlockPeers,
  insertBlock,
  isBlocked,
  removeFriend,
} from '../db';
import {
  emitTo,
  playerIdByUserId,
  userIdByPlayerId,
} from '../sockets/socketRooms';
import { createKeyedQueue } from './keyedQueue';
import {
  BlockPeers,
  cacheBlock,
  cachedBlockPeers,
  loadBlockPeersOnce,
  uncacheBlock,
} from './viewerCache';

const MAX_BLOCKS = 100;

type MutationResult = { ok: true } | { ok: false; error: string };

let engine: Engine | null = null;
const enqueue = createKeyedQueue();

export function setBlockPeersEngine(value: Engine): void {
  engine = value;
}

export function loadBlockPeers(userId: string): Promise<BlockPeers> {
  return loadBlockPeersOnce(userId, () => getBlockPeers(userId));
}

export function warmBlockPeers(userId: string): void {
  if (!cachedBlockPeers(userId)) loadBlockPeers(userId).catch(console.error);
}

export function peerGames(userId: string): Set<string> {
  const peers = cachedBlockPeers(userId);
  if (!peers || !engine) return new Set();
  const playerIds = new Set<number>();
  for (const peer of peers.all) {
    const playerId = playerIdByUserId.get(peer);
    if (playerId !== undefined) playerIds.add(playerId);
  }
  return engine.occupiedGames(playerIds);
}

export function emitBlockedPlayers(io: Server, viewerId: number): void {
  const userId = userIdByPlayerId(viewerId);
  if (userId === undefined || !engine) return;
  const gameEngine = engine;
  loadBlockPeers(userId)
    .then((peers) => {
      const gameName = gameEngine.playerGameName(viewerId);
      if (!gameName) return;
      const playerIds: number[] = [];
      if (!isActorAnonymous(viewerId))
        for (const blocked of peers.blockedByMe) {
          const playerId = playerIdByUserId.get(blocked);
          if (
            playerId !== undefined &&
            gameEngine.isGameMember(playerId, gameName)
          )
            playerIds.push(toClient(viewerId, playerId));
        }
      emitTo(io, viewerId, 'game:blockedPlayers', { playerIds });
    })
    .catch(console.error);
}

function applyBlock(
  blockerId: string,
  blockedId: string,
): Promise<MutationResult> {
  return findUserById(blockedId).then((user) => {
    if (!user) return { ok: false as const, error: 'user not found' };
    return Promise.all([
      isBlocked(new ObjectId(blockerId), new ObjectId(blockedId)),
      countBlocks(blockerId),
    ]).then(([existing, count]) => {
      if (!existing && count >= MAX_BLOCKS)
        return { ok: false as const, error: 'too many blocks' };
      return insertBlock(blockerId, blockedId)
        .then(() => {
          cacheBlock(blockerId, blockedId);
          return removeFriend(blockerId, blockedId);
        })
        .then((): MutationResult => ({ ok: true }));
    });
  });
}

export function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<MutationResult> {
  if (!ObjectId.isValid(blockedId))
    return Promise.resolve({ ok: false, error: 'user not found' });
  const targetId = new ObjectId(blockedId).toHexString();
  if (blockerId === targetId)
    return Promise.resolve({ ok: false, error: 'cannot block yourself' });
  return enqueue(blockerId, () => applyBlock(blockerId, targetId));
}

export function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<MutationResult> {
  if (!ObjectId.isValid(blockedId)) return Promise.resolve({ ok: true });
  const targetId = new ObjectId(blockedId).toHexString();
  return enqueue(blockerId, () =>
    deleteBlock(blockerId, targetId).then((): MutationResult => {
      uncacheBlock(blockerId, targetId);
      return { ok: true };
    }),
  );
}
