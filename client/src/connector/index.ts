import { httpGet, httpSend } from '../lib/http';
import {
  closeSocket,
  getSocket,
  isSocketConnected,
  openSocket,
} from '../lib/socket';
import type {
  Ack,
  ClientSettings,
  FriendsOverview,
  GameSettingsInput,
  GamesPage,
  GamesQuery,
  GameState,
  GenerateMapInput,
  HomeGamesPage,
  HomeGamesQuery,
  IdentifyResult,
  PlayerProfile,
  PlayerSearchResult,
  PlayersPage,
  PlayersQuery,
  ReplayAck,
  SessionResult,
  StoredGame,
  StoredMap,
} from '../lib/types';
import { subscribe, unsubscribe } from './inbound';
import {
  hasPendingSeed,
  isOffline,
  addLocalPlayer as offlineAddLocalPlayer,
  continueHandoff as offlineContinueHandoff,
  dispatch as offlineDispatch,
  setLocalPlayerName as offlineSetLocalPlayerName,
  seedOffline,
  startOffline,
  stopOffline,
} from './offline/host';

type AuthAck = { ok: true } | { ok: false; error: string };
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

type Listener = (payload: never) => void;
type AckCallback = (res: Ack) => void;
type RichAckCallback<R extends Ack> = (res: R) => void;

const RESERVED_GAME_NAME = 'offline';

function isReservedGameName(name: string | undefined): boolean {
  return name?.trim() === RESERVED_GAME_NAME;
}

function route(event: string, data?: unknown, cb?: (res: never) => void): void {
  if (isOffline()) {
    offlineDispatch(event, data, cb as ((res: unknown) => void) | undefined);
    return;
  }
  const socket = getSocket();
  if (!socket) return;
  if (data === undefined && cb === undefined) socket.emit(event);
  else if (data === undefined) socket.emit(event, cb);
  else if (cb === undefined) socket.emit(event, data);
  else socket.emit(event, data, cb);
}

function appendGameFilterParams(
  params: URLSearchParams,
  query: GamesQuery | HomeGamesQuery,
): void {
  for (const id of query.playerIds ?? []) params.append('playerIds', id);
  if (query.name) params.set('name', query.name);
  if (query.mode) params.set('mode', query.mode);
  if (query.mapName) params.set('mapName', query.mapName);
  if (query.generatedMap) params.set('generatedMap', '1');
  if (query.mapGenerationSize)
    params.set('mapGenerationSize', query.mapGenerationSize);
  if (query.mapGenerationWater)
    params.set('mapGenerationWater', query.mapGenerationWater);
  if (query.playersMin !== undefined)
    params.set('playersMin', String(query.playersMin));
  if (query.playersMax !== undefined)
    params.set('playersMax', String(query.playersMax));
  if (query.minRounds !== undefined)
    params.set('minRounds', String(query.minRounds));
  if (query.maxRounds !== undefined)
    params.set('maxRounds', String(query.maxRounds));
  for (const [key, value] of Object.entries(query.settings ?? {}))
    if (value) params.set(key, value);
  if (query.sort) params.set('sort', query.sort);
  if (query.sortDir) params.set('sortDir', query.sortDir);
}

export const connector = {
  get connected(): boolean {
    return isOffline() ? true : isSocketConnected();
  },

  open(gameName: string): void {
    openSocket(gameName);
  },

  close(): void {
    closeSocket();
  },

  isOffline(): boolean {
    return isOffline();
  },

  setMode(offline: boolean): void {
    if (offline) startOffline();
    else stopOffline();
  },

  convertToOffline(state: GameState): void {
    seedOffline(state);
  },

  isConvertingOffline(): boolean {
    return hasPendingSeed();
  },

  addLocalPlayer(name: string): void {
    if (isOffline()) offlineAddLocalPlayer(name);
  },

  setLocalPlayerName(playerId: number, name: string): void {
    if (isOffline()) offlineSetLocalPlayerName(playerId, name);
  },

  continueHandoff(): void {
    offlineContinueHandoff();
  },

  on(event: string, handler: Listener): void {
    subscribe(event, handler);
  },

  off(event: string, handler: Listener): void {
    unsubscribe(event, handler);
  },

  identify(data: { room: string }, cb: (res: IdentifyResult) => void): void {
    if (isOffline()) {
      offlineDispatch('player:identify', data, cb as (res: unknown) => void);
      return;
    }
    getSocket()?.emit('player:identify', data, cb);
  },

  session(cb: (res: SessionResult) => void): void {
    httpGet<SessionResult>('/session')
      .then(cb)
      .catch(() => cb({ account: null, name: '' }));
  },

  listGames(query: HomeGamesQuery, cb: (page: HomeGamesPage) => void): void {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
    appendGameFilterParams(params, query);
    if (query.phase) params.set('phase', query.phase);
    if (query.hasPassword !== undefined)
      params.set('hasPassword', query.hasPassword ? '1' : '0');
    httpGet<HomeGamesPage>('/games/live?' + params.toString())
      .then(cb)
      .catch(() => {});
  },

  listGameHistory(query: GamesQuery, cb: (page: GamesPage) => void): void {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
    appendGameFilterParams(params, query);
    if (query.startedFrom !== undefined)
      params.set('startedFrom', String(query.startedFrom));
    if (query.startedTo !== undefined)
      params.set('startedTo', String(query.startedTo));
    if (query.endedFrom !== undefined)
      params.set('endedFrom', String(query.endedFrom));
    if (query.endedTo !== undefined)
      params.set('endedTo', String(query.endedTo));
    if (query.durationMin !== undefined)
      params.set('durationMin', String(query.durationMin));
    if (query.durationMax !== undefined)
      params.set('durationMax', String(query.durationMax));
    if (query.outcome) params.set('outcome', query.outcome);
    if (query.positionMin !== undefined)
      params.set('positionMin', String(query.positionMin));
    if (query.positionMax !== undefined)
      params.set('positionMax', String(query.positionMax));
    if (query.mine) params.set('mine', '1');
    if (query.rankUserId) params.set('rankUserId', query.rankUserId);
    const empty: GamesPage = {
      games: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
    };
    httpGet<GamesPage>('/games/history?' + params.toString())
      .then(cb)
      .catch(() => cb(empty));
  },

  getStoredGame(id: string, cb: (game: StoredGame | null) => void): void {
    httpGet<StoredGame>('/games/replay/' + encodeURIComponent(id))
      .then((game) => cb('id' in game ? game : null))
      .catch(() => cb(null));
  },

  getStoredMap(id: string, cb: (map: StoredMap | null) => void): void {
    httpGet<StoredMap>('/maps/' + encodeURIComponent(id))
      .then((map) => cb('territories' in map ? map : null))
      .catch(() => cb(null));
  },

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

  getPlayerProfile(
    username: string,
    cb: (profile: PlayerProfile | null) => void,
  ): void {
    httpGet<PlayerProfile>('/players/' + encodeURIComponent(username))
      .then((profile) => cb('id' in profile ? profile : null))
      .catch(() => cb(null));
  },

  listFriends(cb: (overview: FriendsOverview) => void): void {
    const empty: FriendsOverview = { friends: [], incoming: [], outgoing: [] };
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

  register(
    data: { username: string; email: string; password: string },
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

  recoverUsername(
    data: { email: string },
    cb: (res: { ok: true }) => void,
  ): void {
    httpSend<{ ok: true }>('POST', '/auth/recover-username', data)
      .then(cb)
      .catch(() => cb({ ok: true }));
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
    data: { username: string; password: string; stayLoggedIn: boolean },
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

  listMaps(cb: (names: string[]) => void): void {
    route('maps:list', undefined, cb);
  },

  createGame(data: { name?: string }, cb: AckCallback): void {
    if (isReservedGameName(data.name)) {
      cb({ ok: false, error: 'invalid name' });
      return;
    }
    route('game:create', data, cb);
  },

  joinGame(
    data: { gameName: string; password?: string },
    cb: AckCallback,
  ): void {
    route('game:join', data, cb);
  },

  requestState(): void {
    route('game:requestState');
  },

  requestResults(): void {
    route('game:requestResults');
  },

  updateSettings(data: GameSettingsInput, cb: AckCallback): void {
    if (isReservedGameName(data.name)) {
      cb({ ok: false, error: 'invalid name' });
      return;
    }
    route('game:settings', data, cb);
  },

  startGame(cb: AckCallback): void {
    route('game:start', undefined, cb);
  },

  cycleColor(cb: AckCallback): void {
    route('game:cycleColor', undefined, cb);
  },

  nextPhase(cb: AckCallback): void {
    route('game:nextPhase', undefined, cb);
  },

  pause(cb: AckCallback): void {
    route('game:pause', undefined, cb);
  },

  surrender(cb: AckCallback): void {
    route('game:surrender', undefined, cb);
  },

  chat(data: { message: string }): void {
    route('game:chat', data);
  },

  generateMap(data: GenerateMapInput, cb: AckCallback): void {
    route('game:generateMap', data, cb);
  },

  addBot(
    data: { difficulty: string; personality: string },
    cb: AckCallback,
  ): void {
    route('game:addBot', data, cb);
  },

  setBotProfile(
    data: { botPlayerId: number; difficulty: string; personality: string },
    cb: AckCallback,
  ): void {
    route('game:setBotProfile', data, cb);
  },

  removeBot(data: { botPlayerId: number }, cb: AckCallback): void {
    route('game:removeBot', data, cb);
  },

  cycleBotColor(data: { botPlayerId: number }, cb: AckCallback): void {
    route('game:cycleBotColor', data, cb);
  },

  claimTerritory(data: { territoryId: number }, cb: AckCallback): void {
    route('game:claimTerritory', data, cb);
  },

  placeTroop(
    data: { territoryId: number; troops: number },
    cb: AckCallback,
  ): void {
    route('game:placeTroop', data, cb);
  },

  selectCapital(data: { territoryId: number }, cb: AckCallback): void {
    route('game:selectCapital', data, cb);
  },

  selectTerritory(data: { territoryId: number | null }, cb: AckCallback): void {
    route('game:selectTerritory', data, cb);
  },

  deploy(data: { territoryId: number; troops: number }, cb: AckCallback): void {
    route('game:deploy', data, cb);
  },

  requestCards(): void {
    route('game:requestCards');
  },

  playCardSet(data: { cards: (number | null)[] }, cb: AckCallback): void {
    route('game:playCardSet', data, cb);
  },

  fortifySelectStart(
    data: { territoryId: number | null },
    cb: AckCallback,
  ): void {
    route('game:fortifySelectStart', data, cb);
  },

  fortifySelectEnd(data: { territoryId: number }, cb: AckCallback): void {
    route('game:fortifySelectEnd', data, cb);
  },

  fortify(data: { troops: number }, cb: AckCallback): void {
    route('game:fortify', data, cb);
  },

  entrench(
    data: { territoryId: number; troops: number },
    cb: AckCallback,
  ): void {
    route('game:entrench', data, cb);
  },

  toxins(data: { territoryId: number }, cb: AckCallback): void {
    route('game:toxins', data, cb);
  },

  attackSelectStart(
    data: { territoryId: number | null },
    cb: AckCallback,
  ): void {
    route('game:attackSelectStart', data, cb);
  },

  attackSelectEnd<R extends Ack>(
    data: { territoryId: number },
    cb: RichAckCallback<R>,
  ): void {
    route('game:attackSelectEnd', data, cb);
  },

  attack<R extends Ack>(
    data: { type: 'regular' | 'blitz'; troops: number },
    cb: RichAckCallback<R>,
  ): void {
    route('game:attack', data, cb);
  },

  attackMove(data: { troops: number }, cb: AckCallback): void {
    route('game:attackMove', data, cb);
  },

  replay(cb: (res: ReplayAck) => void): void {
    route('game:replay', undefined, cb);
  },

  sendEmoji(data: {
    targetPlayerId?: number;
    emoji: string;
    attackTarget?: unknown;
  }): void {
    route('game:sendEmoji', data);
  },

  offerAlliance(data: { targetPlayerId: number }): void {
    route('game:offerAlliance', data);
  },

  revokeAllianceRequest(data: { targetPlayerId: number }): void {
    route('game:revokeAllianceRequest', data);
  },

  respondAllianceRequest(data: {
    fromPlayerId: number;
    accept: boolean;
  }): void {
    route('game:respondAllianceRequest', data);
  },

  terminateAlliance(data: { targetPlayerId: number }): void {
    route('game:terminateAlliance', data);
  },
};
