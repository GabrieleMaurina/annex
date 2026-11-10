import { httpGet, httpSend } from '../lib/http';
import type {
  AccountResult,
  ClientSettings,
  FriendsOverview,
  MessagesOverview,
  PlayerAchievement,
  PlayerHistoryPoint,
  PlayerProfile,
  PlayerSearchResult,
  PlayersPage,
  PlayersQuery,
} from '../lib/types';

export type AuthAck = { ok: true } | { ok: false; error: string };
type LoginAck =
  | {
      ok: true;
      username: string;
      clientSettings: ClientSettings;
      gameSettings: Record<string, unknown>;
    }
  | { ok: false; error: string };
type LogoutAck =
  | {
      ok: true;
      clientSettings: ClientSettings;
      gameSettings: Record<string, unknown>;
    }
  | { ok: false; error: string };

export const socialConnector = {
  searchPlayers(
    query: string,
    cb: (results: PlayerSearchResult[]) => void,
  ): void {
    httpGet<PlayerSearchResult[]>(
      '/games/players/search?q=' + encodeURIComponent(query),
    )
      .then(cb)
      .catch(() => cb([]));
  },

  listPlayers(query: PlayersQuery, cb: (page: PlayersPage) => void): void {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
    if (query.username) params.set('username', query.username);
    if (query.eloMin !== undefined) params.set('eloMin', String(query.eloMin));
    if (query.eloMax !== undefined) params.set('eloMax', String(query.eloMax));
    if (query.gamesMin !== undefined)
      params.set('gamesMin', String(query.gamesMin));
    if (query.gamesMax !== undefined)
      params.set('gamesMax', String(query.gamesMax));
    params.set('sort', query.sort);
    params.set('sortDir', query.sortDir);
    const empty: PlayersPage = {
      players: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
    };
    httpGet<PlayersPage>('/players?' + params.toString())
      .then(cb)
      .catch(() => cb(empty));
  },

  getPlayerHistory(
    username: string,
    cb: (history: PlayerHistoryPoint[]) => void,
  ): void {
    httpGet<PlayerHistoryPoint[]>(
      '/players/' + encodeURIComponent(username) + '/history',
    )
      .then((history) => cb(Array.isArray(history) ? history : []))
      .catch(() => cb([]));
  },

  getPlayerAchievements(
    username: string,
    cb: (achievements: PlayerAchievement[]) => void,
  ): void {
    httpGet<PlayerAchievement[]>(
      '/players/' + encodeURIComponent(username) + '/achievements',
    )
      .then((achievements) =>
        cb(Array.isArray(achievements) ? achievements : []),
      )
      .catch(() => cb([]));
  },

  getPlayerProfile(
    username: string,
    cb: (profile: PlayerProfile | null) => void,
  ): void {
    httpGet<PlayerProfile>('/players/' + encodeURIComponent(username))
      .then((profile) => cb('id' in profile ? profile : null))
      .catch(() => cb(null));
  },

  listFriends(cb: (overview: FriendsOverview) => void): void {
    const empty: FriendsOverview = {
      friends: [],
      incoming: [],
      outgoing: [],
      blocked: [],
    };
    httpGet<FriendsOverview>('/friends')
      .then(cb)
      .catch(() => cb(empty));
  },

  sendFriendRequest(userId: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/friends/requests', { userId })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  acceptFriendRequest(userId: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/friends/accept', { userId })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  removeFriend(userId: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/friends/remove', { userId })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  listMessages(cb: (overview: MessagesOverview) => void): void {
    const empty: MessagesOverview = { conversations: [], blocked: [] };
    httpGet<MessagesOverview>('/messages')
      .then(cb)
      .catch(() => cb(empty));
  },

  sendMessage(userId: string, text: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/messages', { userId, text })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  listBlocks(cb: (blocked: string[]) => void): void {
    httpGet<{ blocked: string[] }>('/blocks')
      .then((res) => cb(res.blocked))
      .catch(() => cb([]));
  },

  blockUser(userId: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/blocks', { userId })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  unblockUser(userId: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/blocks/remove', { userId })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  reportPlayer(
    data: { userId: string; reason: string; gameId?: string },
    cb: (res: AuthAck) => void,
  ): void {
    httpSend<AuthAck>('POST', '/reports', data)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  register(
    data: {
      username: string;
      email: string;
      password: string;
      country: string;
    },
    cb: (res: AuthAck) => void,
  ): void {
    httpSend<AuthAck>('POST', '/auth/register', data)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  confirmEmail(data: { code: string }, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/auth/confirm-email', data)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  requestPasswordReset(
    data: { email: string },
    cb: (res: { ok: true }) => void,
  ): void {
    httpSend<{ ok: true }>('POST', '/auth/request-password-reset', data)
      .then(cb)
      .catch(() => cb({ ok: true }));
  },

  resetPassword(
    data: { code: string; password: string },
    cb: (res: AuthAck) => void,
  ): void {
    httpSend<AuthAck>('POST', '/auth/reset-password', data)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  login(
    data: { email: string; password: string; stayLoggedIn: boolean },
    cb: (res: LoginAck) => void,
  ): void {
    httpSend<LoginAck>('POST', '/auth/login', data)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  logout(cb: (res: LogoutAck) => void): void {
    httpSend<LogoutAck>('POST', '/auth/logout', {})
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  getAccount(cb: (res: AccountResult) => void): void {
    httpGet<AccountResult>('/account')
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  changePassword(
    data: { currentPassword: string; newPassword: string },
    cb: (res: AuthAck) => void,
  ): void {
    httpSend<AuthAck>('POST', '/account/password', data)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  setCountry(country: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/account/country', { country })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  setBio(bio: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/account/bio', { bio })
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  uploadPicture(data: { image: string }, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/account/picture', data)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  removePicture(cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>('POST', '/account/picture/remove', {})
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },
};
