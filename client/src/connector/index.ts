import { checkNewAchievements } from '../common/achievements/newAchievements';
import { httpGet, httpSend } from '../lib/http';
import {
  closeSocket,
  getSocket,
  isSocketConnected,
  openSocket,
} from '../lib/socket';
import type {
  Ack,
  EarthMapInput,
  ExportCallback,
  GameSettingsInput,
  GamesPage,
  GamesQuery,
  GameState,
  GenerateMapInput,
  HomeGamesPage,
  HomeGamesQuery,
  IdentifyResult,
  PlayerMapDetail,
  PlayerMapSaveBody,
  PlayerMapsPage,
  PlayerMapsQuery,
  ReplayAck,
  SessionResult,
  StoredGame,
  StoredMap,
} from '../lib/types';
import type { Tutorial } from '../tutorials/tutorials';
import { requestExport } from './exportRequest';
import { appendGameFilterParams } from './gameFilterParams';
import { subscribe, unsubscribe } from './inbound';
import {
  consumeConvertedFromOnline,
  exportOfflineGame,
  isOffline,
  isTutorial,
  addLocalPlayer as offlineAddLocalPlayer,
  continueHandoff as offlineContinueHandoff,
  cycleLocalPlayerColor as offlineCycleLocalPlayerColor,
  dispatch as offlineDispatch,
  removeLocalPlayer as offlineRemoveLocalPlayer,
  setLocalPlayerName as offlineSetLocalPlayerName,
  restartOffline,
  seedOffline,
  startOffline,
  stopOffline,
  tutorialAllows,
} from './offline/host';
import { type AuthAck, socialConnector } from './socialConnector';

type SaveMapAck = { ok: true; id: string } | { ok: false; error: string };

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

  isTutorial(): boolean {
    return isTutorial();
  },

  tutorialAllows(event: string): boolean {
    return tutorialAllows(event);
  },

  setMode(offline: boolean, tutorial: Tutorial | null): void {
    if (offline) startOffline(tutorial);
    else stopOffline();
  },

  convertToOffline(state: GameState): void {
    seedOffline(state);
  },

  isConvertingOffline(): boolean {
    return consumeConvertedFromOnline();
  },

  addLocalPlayer(name: string, team?: number): void {
    if (isOffline()) offlineAddLocalPlayer(name, team);
  },

  removeLocalPlayer(playerId: number): void {
    if (isOffline()) offlineRemoveLocalPlayer(playerId);
  },

  setLocalPlayerName(playerId: number, name: string): void {
    if (isOffline()) offlineSetLocalPlayerName(playerId, name);
  },

  cycleLocalPlayerColor(playerId: number): void {
    if (isOffline()) offlineCycleLocalPlayerColor(playerId);
  },

  continueHandoff(): void {
    offlineContinueHandoff();
  },

  canRestart(players: GameState['players']): boolean {
    return (
      isOffline() &&
      !isTutorial() &&
      players.every((p) => p.isBot || p.eliminated || p.surrendered)
    );
  },

  restart(): void {
    restartOffline();
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

  findRandomGame(cb: (gameName: string | null) => void): void {
    httpGet<{ ok: boolean; gameName: string | null }>('/games/random')
      .then((res) => cb(res.gameName))
      .catch(() => cb(null));
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

  isPlayerOnline(userId: string, cb: (online: boolean) => void): void {
    httpGet<{ online: boolean }>(
      '/presence?userId=' + encodeURIComponent(userId),
    )
      .then((res) => cb(res.online))
      .catch(() => cb(false));
  },

  watchGame(userId: string, cb: (gameName: string | null) => void): void {
    httpGet<{ gameName: string | null }>(
      '/games/watch?userId=' + encodeURIComponent(userId),
    )
      .then((res) => cb(res.gameName))
      .catch(() => cb(null));
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

  getGameExport(id: string, cb: ExportCallback): void {
    requestExport('/games/replay/' + encodeURIComponent(id) + '/export', cb);
  },

  getOfflineGameExport(cb: ExportCallback): void {
    cb(exportOfflineGame());
  },

  getPlayerExport(username: string, cb: ExportCallback): void {
    requestExport('/players/' + encodeURIComponent(username) + '/export', cb);
  },

  saveReplayMap(gameId: string, cb: (res: SaveMapAck) => void): void {
    httpSend<SaveMapAck>(
      'POST',
      '/games/replay/' + encodeURIComponent(gameId) + '/save-map',
      {},
    )
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  getStoredMap(id: string, cb: (map: StoredMap | null) => void): void {
    httpGet<StoredMap>('/replay-maps/' + encodeURIComponent(id))
      .then((map) => cb('territories' in map ? map : null))
      .catch(() => cb(null));
  },

  listPlayerMaps(
    query: PlayerMapsQuery,
    cb: (page: PlayerMapsPage) => void,
  ): void {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
    if (query.q) params.set('q', query.q);
    if (query.authorId) params.set('author', query.authorId);
    if (query.mine) params.set('mine', '1');
    if (query.notMine) params.set('notMine', '1');
    if (query.liked) params.set('liked', '1');
    if (query.notLiked) params.set('notLiked', '1');
    if (query.territoryMin !== undefined)
      params.set('territoryMin', String(query.territoryMin));
    if (query.territoryMax !== undefined)
      params.set('territoryMax', String(query.territoryMax));
    if (query.generationType) params.set('genType', query.generationType);
    if (query.generationFill) params.set('genFill', query.generationFill);
    if (query.generationSize) params.set('genSize', query.generationSize);
    if (query.generationTile) params.set('genTile', query.generationTile);
    if (query.generationSeas !== undefined)
      params.set('genSeas', query.generationSeas ? '1' : '0');
    if (query.generationTimed !== undefined)
      params.set('genTimed', query.generationTimed ? '1' : '0');
    if (query.generationDirectional !== undefined)
      params.set('genDirectional', query.generationDirectional ? '1' : '0');
    if (query.generationSwitched !== undefined)
      params.set('genSwitched', query.generationSwitched ? '1' : '0');
    if (query.generationUnlockable !== undefined)
      params.set('genUnlockable', query.generationUnlockable ? '1' : '0');
    params.set('sort', query.sort);
    const empty: PlayerMapsPage = {
      maps: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
    };
    httpGet<PlayerMapsPage>('/player-maps?' + params.toString())
      .then((r) => cb('maps' in r ? r : empty))
      .catch(() => cb(empty));
  },

  getPlayerMap(id: string, cb: (map: PlayerMapDetail | null) => void): void {
    httpGet<PlayerMapDetail>('/player-maps/' + encodeURIComponent(id))
      .then((map) => cb('territories' in map ? map : null))
      .catch(() => cb(null));
  },

  savePlayerMap(body: PlayerMapSaveBody, cb: (res: SaveMapAck) => void): void {
    httpSend<SaveMapAck>('POST', '/player-maps', body)
      .then((res) => {
        cb(res);
        if (res.ok) checkNewAchievements();
      })
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  listMyMapNames(cb: (names: string[]) => void): void {
    httpGet<{ ok: boolean; names?: string[] }>('/player-maps/mine/names')
      .then((res) => cb(res.ok && res.names ? res.names : []))
      .catch(() => cb([]));
  },

  updatePlayerMap(
    id: string,
    body: PlayerMapSaveBody,
    cb: (res: AuthAck) => void,
  ): void {
    httpSend<AuthAck>('POST', '/player-maps/' + encodeURIComponent(id), body)
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  deletePlayerMap(id: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>(
      'POST',
      '/player-maps/' + encodeURIComponent(id) + '/delete',
      {},
    )
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  likeMap(id: string, liked: boolean, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>(
      'POST',
      '/player-maps/' + encodeURIComponent(id) + (liked ? '/like' : '/unlike'),
      {},
    )
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  getMapLiked(id: string, cb: (liked: boolean | null) => void): void {
    httpGet<{ ok: boolean; liked?: boolean }>(
      '/player-maps/' + encodeURIComponent(id) + '/liked',
    )
      .then((res) => cb(res.ok ? !!res.liked : null))
      .catch(() => cb(null));
  },

  reportMap(id: string, cb: (res: AuthAck) => void): void {
    httpSend<AuthAck>(
      'POST',
      '/player-maps/' + encodeURIComponent(id) + '/report',
      {},
    )
      .then(cb)
      .catch(() => cb({ ok: false, error: 'server error' }));
  },

  ...socialConnector,

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

  cycleBotSpeed(cb: AckCallback): void {
    route('game:cycleBotSpeed', undefined, cb);
  },

  surrender(cb: AckCallback): void {
    route('game:surrender', undefined, cb);
  },

  endGame(cb: AckCallback): void {
    route('game:endGame', undefined, cb);
  },

  toggleDraw(cb: AckCallback): void {
    route('game:toggleDraw', undefined, cb);
  },

  toggleAbort(cb: AckCallback): void {
    route('game:toggleAbort', undefined, cb);
  },

  chat(data: { message: string }): void {
    route('game:chat', data);
  },

  generateMap(data: GenerateMapInput, cb: AckCallback): void {
    route('game:generateMap', data, cb);
  },

  clearMap(cb: AckCallback): void {
    route('game:clearMap', undefined, cb);
  },

  selectPlayerMap(data: { mapId: string }, cb: AckCallback): void {
    route('game:selectPlayerMap', data, cb);
  },

  selectEarthMap(data: EarthMapInput, cb: AckCallback): void {
    route('game:selectEarthMap', data, cb);
  },

  addBot(
    data: { difficulty: string; personality: string; team?: number },
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

  buyShips(
    data: {
      sourceTerritoryId: number;
      seaTerritoryId: number;
      ships: number;
      fromPool: boolean;
    },
    cb: AckCallback,
  ): void {
    route('game:buyShips', data, cb);
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

  quickFortify(
    data: { territoryId: number; minimal: boolean },
    cb: AckCallback,
  ): void {
    route('game:quickFortify', data, cb);
  },

  sailSelectStart(data: { territoryId: number | null }, cb: AckCallback): void {
    route('game:sailSelectStart', data, cb);
  },

  sailSelectEnd(data: { territoryId: number }, cb: AckCallback): void {
    route('game:sailSelectEnd', data, cb);
  },

  sail(data: { ships: number }, cb: AckCallback): void {
    route('game:sail', data, cb);
  },

  quickSail(
    data: { territoryId: number; minimal: boolean },
    cb: AckCallback,
  ): void {
    route('game:quickSail', data, cb);
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

  buildNuke(cb: AckCallback): void {
    route('game:buildNuke', {}, cb);
  },

  buildAntiNuke(cb: AckCallback): void {
    route('game:buildAntiNuke', {}, cb);
  },

  advanceNuke(data: { index: number }, cb: AckCallback): void {
    route('game:advanceNuke', data, cb);
  },

  launchNuke(data: { territoryId: number }, cb: AckCallback): void {
    route('game:launchNuke', data, cb);
  },

  deployAntiNuke(data: { territoryId: number }, cb: AckCallback): void {
    route('game:deployAntiNuke', data, cb);
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
    data: { type: 'manual' | 'blitz'; troops: number },
    cb: RichAckCallback<R>,
  ): void {
    route('game:attack', data, cb);
  },

  attackMove(data: { troops: number }, cb: AckCallback): void {
    route('game:attackMove', data, cb);
  },

  quickAttack(
    data: { territoryId: number; minimal: boolean },
    cb: AckCallback,
  ): void {
    route('game:quickAttack', data, cb);
  },

  unlockTile(data: { tileId: number; enter: boolean }, cb: AckCallback): void {
    route('game:unlock', data, cb);
  },

  flipSwitch(data: { switchId: number }, cb: AckCallback): void {
    route('game:flipSwitch', data, cb);
  },

  attackSeaSelectStart(
    data: { territoryId: number | null },
    cb: AckCallback,
  ): void {
    route('game:attackSeaSelectStart', data, cb);
  },

  attackSeaSelectDefender<R extends Ack>(
    data: { defenderId: number },
    cb: RichAckCallback<R>,
  ): void {
    route('game:attackSeaSelectDefender', data, cb);
  },

  attackSea<R extends Ack>(
    data: { type: 'manual' | 'blitz'; ships: number },
    cb: RichAckCallback<R>,
  ): void {
    route('game:attackSea', data, cb);
  },

  quickAttackSea(data: { territoryId: number }, cb: AckCallback): void {
    route('game:quickAttackSea', data, cb);
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

  blockPlayerInGame(playerId: number, cb: (res: AuthAck) => void): void {
    route('game:block', { playerId }, cb);
  },

  unblockPlayerInGame(playerId: number, cb: (res: AuthAck) => void): void {
    route('game:unblock', { playerId }, cb);
  },

  reportPlayerInGame(
    playerId: number,
    reason: string,
    cb: (res: AuthAck) => void,
  ): void {
    route('game:report', { playerId, reason }, cb);
  },

  getPlayerProfileInGame(
    playerId: number,
    cb: (
      res:
        | { ok: true; picture: string | null; bio: string }
        | { ok: false; error: string },
    ) => void,
  ): void {
    route('game:profile', { playerId }, cb);
  },
};
