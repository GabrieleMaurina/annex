import type { FriendsOverview } from '../../lib/types';

export type FriendState = 'none' | 'friends' | 'outgoing' | 'incoming';

export function friendStateOf(
  overview: FriendsOverview,
  userId: string,
): FriendState {
  if (overview.friends.some((f) => f.id === userId)) return 'friends';
  if (overview.outgoing.some((f) => f.id === userId)) return 'outgoing';
  if (overview.incoming.some((f) => f.id === userId)) return 'incoming';
  return 'none';
}
