import { socket } from '../lib/socket';
import type {
  Ack,
  GameSettingsInput,
  GenerateMapInput,
  ReplayAck,
} from '../lib/types';
import { subscribe, unsubscribe } from './inbound';
import {
  isOffline,
  addLocalPlayer as offlineAddLocalPlayer,
  continueHandoff as offlineContinueHandoff,
  dispatch as offlineDispatch,
  setClientName as offlineSetClientName,
  startOffline,
  stopOffline,
} from './offline/host';

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
  if (data === undefined && cb === undefined) socket.emit(event);
  else if (data === undefined) socket.emit(event, cb);
  else if (cb === undefined) socket.emit(event, data);
  else socket.emit(event, data, cb);
}

export const connector = {
  get connected(): boolean {
    return isOffline() ? true : socket.connected;
  },

  isOffline(): boolean {
    return isOffline();
  },

  setMode(offline: boolean, playerName: string): void {
    if (offline) startOffline(playerName);
    else stopOffline();
  },

  addLocalPlayer(name: string): void {
    if (isOffline()) offlineAddLocalPlayer(name);
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

  identify(
    data: { playerKey: string; playerName: string; room: string },
    cb: (res: { id: number; gameName: string | null }) => void,
  ): void {
    if (isOffline()) {
      socket.emit('player:identify', data, () => {});
      offlineDispatch('player:identify', data, cb as (res: unknown) => void);
      return;
    }
    socket.emit('player:identify', data, cb);
  },

  setName(data: { name: string }): void {
    socket.emit('player:setName', data);
    offlineSetClientName(data.name);
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
