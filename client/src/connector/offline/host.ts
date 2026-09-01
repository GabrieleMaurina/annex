import {
  createEngine,
  type Engine,
  type EngineCallbacks,
  type MapSize,
  type WaterLevel,
} from 'engine';
import type { GameState } from '../../lib/types';
import { publish } from '../inbound';
import { browserWorkerPort } from './browserWorkerPort';
import { loadBuiltinMaps } from './maps';

const URL_ROOM = 'offline';

let engine: Engine | null = null;
let active = false;
let ready = false;
let session = 0;
let gameName = '';
let hostId: number | null = null;
let currentActorId: number | null = null;
let localPlayerIds: number[] = [];
let lastState: GameState | null = null;
let pendingActor: number | null = null;
let bufferedTurnStarted: unknown = null;
let pausedForHandoff = false;
const queue: (() => void)[] = [];

function beginHandoff(next: number, turnStarted: unknown): void {
  pendingActor = next;
  bufferedTurnStarted = turnStarted;
  if (engine && hostId !== null && !lastState?.paused)
    pausedForHandoff = engine.pauseGame(hostId).ok;
  const player = lastState?.players.find((p) => p.id === next);
  publish('offline:handoff', {
    toName: player?.name ?? 'Player',
    color: player?.color ?? 0,
  });
}

export function continueHandoff(): void {
  if (pendingActor === null || engine === null || hostId === null) return;
  currentActorId = pendingActor;
  pendingActor = null;
  publish('offline:actor', { selfId: currentActorId });
  if (pausedForHandoff) {
    engine.pauseGame(hostId);
    pausedForHandoff = false;
  }
  if (bufferedTurnStarted !== null) {
    publish('game:turnStarted', bufferedTurnStarted);
    bufferedTurnStarted = null;
  }
  engine.requestState(currentActorId);
}

function turnPlayerId(state: GameState): number | undefined {
  return state.players[state.turnPlayerIndex]?.id;
}

function forward(event: string) {
  return (playerId: number, payload?: unknown) => {
    if (
      event === 'game:state' &&
      playerId === currentActorId &&
      pendingActor === null
    ) {
      const state = payload as GameState;
      lastState = state;
      const next = turnPlayerId(state);
      if (
        state.state === 'playing' &&
        next !== undefined &&
        next !== currentActorId &&
        localPlayerIds.includes(next)
      ) {
        beginHandoff(next, bufferedTurnStarted);
        bufferedTurnStarted = null;
        return;
      }
    }

    if (
      event === 'game:turnStarted' &&
      pendingActor !== null &&
      playerId === currentActorId &&
      (payload as { playerId: number }).playerId === pendingActor
    ) {
      bufferedTurnStarted = payload;
      return;
    }

    if (pendingActor !== null || playerId !== currentActorId) return;

    if (event === 'game:turnStarted') {
      const next = (payload as { playerId: number }).playerId;
      if (next !== currentActorId && localPlayerIds.includes(next)) {
        beginHandoff(next, payload);
        return;
      }
    }
    publish(event, payload);
  };
}

const callbacks: EngineCallbacks = {
  onHomeGames: () => {},
  onGameState: forward('game:state'),
  onCards: forward('game:cards'),
  onMission: forward('game:mission'),
  onLogs: forward('game:logs'),
  onResults: forward('game:results'),
  onCardSetPlayed: forward('game:cardSetPlayed'),
  onKicked: forward('game:kicked'),
  onChatMessage: forward('game:chatMessage'),
  onEmojiSent: forward('game:emojiSent'),
  onAllianceRequested: forward('game:allianceRequested'),
  onAllianceFormed: forward('game:allianceFormed'),
  onAllianceDeclined: forward('game:allianceDeclined'),
  onAllianceTerminated: forward('game:allianceTerminated'),
  onCapitalPlacementStarted: forward('game:capitalPlacementStarted'),
  onTerritoryClaimed: forward('game:territoryClaimed'),
  onTurnStarted: forward('game:turnStarted'),
  onDeployed: forward('game:deployed'),
  onDeployedMany: forward('game:deployedMany'),
  onFortified: forward('game:fortified'),
  onEntrenched: forward('game:entrenched'),
  onToxined: forward('game:toxined'),
  onToxinExpired: forward('game:toxinExpired'),
  onRadiationUpcoming: forward('game:radiationUpcoming'),
  onRadiationChanged: forward('game:radiationChanged'),
  onStarved: forward('game:starved'),
  onAttacked: forward('game:attacked'),
  onTankFired: forward('game:tankFired'),
  onAttackMoved: forward('game:attackMoved'),
  onSelected: forward('game:selected'),
  onMapGenerated: forward('game:mapGenerated'),
  onRoomChanged: () => {},
};

function buildEngine(): Engine {
  return createEngine(callbacks, {
    botWorker: {
      create: () =>
        browserWorkerPort(
          new Worker(new URL('./workers/botWorker.ts', import.meta.url), {
            type: 'module',
          }),
        ),
    },
    mapgenWorker: {
      create: () =>
        browserWorkerPort(
          new Worker(new URL('./workers/mapgenWorker.ts', import.meta.url), {
            type: 'module',
          }),
        ),
    },
  });
}

export function isOffline(): boolean {
  return active;
}

export function startOffline(): void {
  if (active) return;
  active = true;
  ready = false;
  pendingActor = null;
  bufferedTurnStarted = null;
  pausedForHandoff = false;
  lastState = null;
  loadBuiltinMaps().then((maps) => {
    if (!active) return;
    if (!engine) engine = buildEngine();
    engine.loadMaps(maps);
    session += 1;
    const hostName = 'You';
    hostId = engine.addPlayer(hostName).id;
    currentActorId = hostId;
    localPlayerIds = [hostId];
    gameName = `Game with ${hostName}`;
    if (!engine.createGame(hostId, { name: gameName }, true).ok) {
      gameName = `${URL_ROOM}-${session}`;
      engine.createGame(hostId, { name: gameName }, true);
    }
    ready = true;
    const pending = queue.splice(0);
    for (const fn of pending) fn();
  });
}

export function stopOffline(): void {
  if (!active) return;
  active = false;
  ready = false;
  queue.length = 0;
  if (engine && hostId !== null) engine.disconnect(hostId);
  hostId = null;
  currentActorId = null;
  localPlayerIds = [];
  pendingActor = null;
}

export function setLocalPlayerName(playerId: number, name: string): void {
  if (!active || !engine || hostId === null) return;
  if (playerId === hostId || !localPlayerIds.includes(playerId)) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  engine.setName(playerId, trimmed);
  if (currentActorId !== null) engine.requestState(currentActorId);
}

export function addLocalPlayer(name: string): void {
  if (!engine || !ready || hostId === null || !lastState) return;
  if (lastState.players.length >= lastState.slots)
    engine.updateSettings(hostId, { slots: lastState.players.length + 1 });
  const seatName = name.trim() || `Player ${lastState.players.length + 1}`;
  const seatId = engine.addPlayer(seatName).id;
  engine.joinGame(seatId, gameName);
  localPlayerIds.push(seatId);
}

export function dispatch(
  event: string,
  data: unknown,
  cb?: (res: unknown) => void,
): void {
  const fn = () => run(event, data, cb);
  if (ready) fn();
  else queue.push(fn);
}

function run(event: string, data: unknown, cb?: (res: unknown) => void): void {
  if (!engine || currentActorId === null) return;
  const id = currentActorId;
  const d = (data ?? {}) as Record<string, unknown>;

  switch (event) {
    case 'player:identify':
      cb?.({
        id,
        gameName: URL_ROOM,
        name: 'You',
        account: null,
      });
      return;
    case 'maps:list':
      cb?.(engine.listMaps());
      return;
    case 'game:requestState':
      engine.requestState(id);
      return;
    case 'game:requestResults':
      engine.requestResults(id);
      return;
    case 'game:settings':
      cb?.(engine.updateSettings(id, d));
      return;
    case 'game:start':
      cb?.(engine.startGame(id));
      return;
    case 'game:cycleColor':
      cb?.(engine.cycleColor(id));
      return;
    case 'game:nextPhase':
      cb?.(engine.nextPhase(id));
      return;
    case 'game:pause':
      cb?.(engine.pauseGame(hostId ?? id));
      return;
    case 'game:surrender':
      cb?.(engine.surrender(id));
      return;
    case 'game:chat':
      engine.sendChat(id, d.message as string);
      return;
    case 'game:generateMap':
      engine.generateMap(
        id,
        d.seed as string,
        d.size as MapSize,
        d.water as WaterLevel,
        cb ?? (() => {}),
      );
      return;
    case 'game:addBot':
      cb?.(engine.addBot(id, d.difficulty, d.personality));
      return;
    case 'game:setBotProfile':
      cb?.(
        engine.setBotProfile(
          id,
          d.botPlayerId as number,
          d.difficulty,
          d.personality,
        ),
      );
      return;
    case 'game:removeBot':
      cb?.(engine.removeBot(id, d.botPlayerId as number));
      return;
    case 'game:cycleBotColor':
      cb?.(engine.cycleBotColor(id, d.botPlayerId as number));
      return;
    case 'game:claimTerritory':
      cb?.(engine.claimTerritory(id, d.territoryId));
      return;
    case 'game:placeTroop':
      cb?.(engine.placeTroop(id, d.territoryId, d.troops));
      return;
    case 'game:selectCapital':
      cb?.(engine.selectCapital(id, d.territoryId));
      return;
    case 'game:selectTerritory':
      cb?.(engine.selectTerritory(id, d.territoryId));
      return;
    case 'game:deploy':
      cb?.(engine.deploy(id, d.territoryId, d.troops));
      return;
    case 'game:requestCards':
      engine.requestCards(id);
      return;
    case 'game:playCardSet':
      cb?.(engine.playCardSet(id, d.cards));
      return;
    case 'game:fortifySelectStart':
      cb?.(engine.fortifySelectStart(id, d.territoryId));
      return;
    case 'game:fortifySelectEnd':
      cb?.(engine.fortifySelectEnd(id, d.territoryId));
      return;
    case 'game:fortify':
      cb?.(engine.fortify(id, d.troops));
      return;
    case 'game:entrench':
      cb?.(engine.entrench(id, d.territoryId, d.troops));
      return;
    case 'game:toxins':
      cb?.(engine.toxin(id, d.territoryId));
      return;
    case 'game:attackSelectStart':
      cb?.(engine.attackSelectStart(id, d.territoryId));
      return;
    case 'game:attackSelectEnd':
      cb?.(engine.attackSelectEnd(id, d.territoryId));
      return;
    case 'game:attack':
      cb?.(engine.attack(id, d.type, d.troops));
      return;
    case 'game:attackMove':
      cb?.(engine.attackMove(id, d.troops));
      return;
    case 'game:replay':
      cb?.(engine.requestReplay(id));
      return;
    case 'game:sendEmoji':
      engine.sendEmoji(
        id,
        d.emoji,
        d.targetPlayerId as number | undefined,
        d.attackTarget,
      );
      return;
    case 'game:offerAlliance':
      engine.offerAlliance(id, d.targetPlayerId as number);
      return;
    case 'game:revokeAllianceRequest':
      engine.revokeAllianceRequest(id, d.targetPlayerId as number);
      return;
    case 'game:respondAllianceRequest':
      engine.respondAllianceRequest(
        id,
        d.fromPlayerId as number,
        d.accept as boolean,
      );
      return;
    case 'game:terminateAlliance':
      engine.terminateAlliance(id, d.targetPlayerId as number);
      return;
    default:
      cb?.({ ok: false, error: `unsupported offline event: ${event}` });
  }
}
