import { SESSION_TTL_MS, StoredBlockPeers } from '../db';

export interface CachedReputation {
  reputation: number;
  recoveryFrom: number | null;
  createdAt: number;
}

const MAX_TOKENS = 100000;
const MAX_USERS = 50000;

const userIdByToken = new Map<string, { userId: string; seenAt: number }>();
const reputationByUserId = new Map<string, CachedReputation>();
const warmUpTokens = new Set<string>();

function evictOldest(
  entries: Map<string, unknown> | Set<string>,
  max: number,
  onEvict?: (key: string) => void,
): void {
  while (entries.size > max) {
    const oldest = entries.keys().next().value as string;
    entries.delete(oldest);
    onEvict?.(oldest);
  }
}

export function cacheReputation(
  userId: string,
  reputation: CachedReputation,
): void {
  reputationByUserId.delete(userId);
  reputationByUserId.set(userId, reputation);
  evictOldest(reputationByUserId, MAX_USERS);
}

export function cacheViewer(
  token: string,
  userId: string,
  reputation: CachedReputation,
  cachedBeforeRead: CachedReputation | undefined,
): void {
  userIdByToken.delete(token);
  userIdByToken.set(token, { userId, seenAt: Date.now() });
  evictOldest(userIdByToken, MAX_TOKENS, (oldest) =>
    warmUpTokens.delete(oldest),
  );
  if (reputationByUserId.get(userId) === cachedBeforeRead)
    cacheReputation(userId, reputation);
}

export function forgetToken(token: string): void {
  userIdByToken.delete(token);
}

export function forgetUser(userId: string): void {
  for (const [token, entry] of userIdByToken)
    if (entry.userId === userId) {
      userIdByToken.delete(token);
      warmUpTokens.delete(token);
    }
}

export function cachedUserId(token: string): string | undefined {
  const entry = userIdByToken.get(token);
  if (!entry) return undefined;
  if (Date.now() - entry.seenAt <= SESSION_TTL_MS) return entry.userId;
  userIdByToken.delete(token);
  warmUpTokens.delete(token);
  return undefined;
}

export function cachedReputation(userId: string): CachedReputation | undefined {
  const reputation = reputationByUserId.get(userId);
  if (reputation) cacheReputation(userId, reputation);
  return reputation;
}

export function claimWarmUp(token: string): boolean {
  if (warmUpTokens.has(token)) return false;
  warmUpTokens.add(token);
  evictOldest(warmUpTokens, MAX_TOKENS);
  return true;
}

export interface BlockPeers {
  blockedByMe: Set<string>;
  blockedMe: Set<string>;
  all: Set<string>;
}

const blockPeersByUserId = new Map<string, BlockPeers>();
const blockPeerLoads = new Map<string, Promise<BlockPeers>>();

function storeBlockPeers(userId: string, peers: BlockPeers): void {
  blockPeersByUserId.delete(userId);
  blockPeersByUserId.set(userId, peers);
  evictOldest(blockPeersByUserId, MAX_USERS);
}

export function cachedBlockPeers(userId: string): BlockPeers | undefined {
  const peers = blockPeersByUserId.get(userId);
  if (peers) storeBlockPeers(userId, peers);
  return peers;
}

export function loadBlockPeersOnce(
  userId: string,
  load: () => Promise<StoredBlockPeers>,
): Promise<BlockPeers> {
  const cached = blockPeersByUserId.get(userId);
  if (cached) return Promise.resolve(cached);
  const pending = blockPeerLoads.get(userId);
  if (pending) return pending;
  const loading = load().then(
    ({ blockedByMe, blockedMe }) => {
      const peers: BlockPeers = {
        blockedByMe,
        blockedMe,
        all: new Set([...blockedByMe, ...blockedMe]),
      };
      storeBlockPeers(userId, peers);
      blockPeerLoads.delete(userId);
      return peers;
    },
    (error) => {
      blockPeerLoads.delete(userId);
      throw error;
    },
  );
  blockPeerLoads.set(userId, loading);
  return loading;
}

function updatePeers(userId: string, apply: (peers: BlockPeers) => void) {
  const cached = blockPeersByUserId.get(userId);
  if (cached) {
    apply(cached);
    return;
  }
  blockPeerLoads
    .get(userId)
    ?.then(apply)
    .catch(() => undefined);
}

export function cacheBlock(blockerId: string, blockedId: string): void {
  updatePeers(blockerId, (peers) => {
    peers.blockedByMe.add(blockedId);
    peers.all.add(blockedId);
  });
  updatePeers(blockedId, (peers) => {
    peers.blockedMe.add(blockerId);
    peers.all.add(blockerId);
  });
}

export function uncacheBlock(blockerId: string, blockedId: string): void {
  updatePeers(blockerId, (peers) => {
    peers.blockedByMe.delete(blockedId);
    if (!peers.blockedMe.has(blockedId)) peers.all.delete(blockedId);
  });
  updatePeers(blockedId, (peers) => {
    peers.blockedMe.delete(blockerId);
    if (!peers.blockedByMe.has(blockerId)) peers.all.delete(blockerId);
  });
}
