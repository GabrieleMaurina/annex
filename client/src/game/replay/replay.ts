import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { playSound } from '../../lib/sounds';
import type {
  GameState,
  ReplayAnimation,
  ReplayFrame,
  ReplayHand,
  ReplayLogEntry,
  ReplayPlayerStats,
  ReplaySeaShips,
  ReplayTerritory,
  StoredGame,
} from '../../lib/types';

export function groupSeaShips(flat: ReplaySeaShips[]): GameState['seas'] {
  const byPlayerBySea = new Map<
    number,
    { playerId: number; ships: number }[]
  >();
  for (const entry of flat) {
    const list = byPlayerBySea.get(entry.seaTerritoryId) ?? [];
    list.push({ playerId: entry.playerId, ships: entry.ships });
    byPlayerBySea.set(entry.seaTerritoryId, list);
  }
  return [...byPlayerBySea.entries()].map(([id, ships]) => ({ id, ships }));
}

export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8, 16, 32];
const BASE_FRAME_INTERVAL_MS = 800;

export type ReplayMoveUnit = 'frame' | 'turn' | 'round';

export interface ReplayData {
  initial: ReplayTerritory[];
  initialRadiation: number[];
  frames: ReplayFrame[];
  log: ReplayLogEntry[];
}

export interface ReplayTurnMarker {
  afterFrame: number;
  playerId: number;
  roundNumber: number;
}

export interface ReplayChatMessage {
  afterFrame: number;
  senderId: number;
  name: string;
  message: string;
}

export interface ReplayEmoji {
  afterFrame: number;
  senderId: number;
  targetPlayerId: number | null;
  emoji: string;
}

export interface FoldedReplay {
  data: ReplayData;
  turnMarkers: ReplayTurnMarker[];
  chat: ReplayChatMessage[];
  emoji: ReplayEmoji[];
  hasStats: boolean;
}

export function foldStoredReplay(
  replay: StoredGame['replay'],
  serverLog: ReplayLogEntry[],
  playerIds: number[],
): FoldedReplay {
  const players = new Set(playerIds);
  const territoryById = new Map(
    replay.initialTerritories.map((t) => [t.id, { ...t }]),
  );
  const seaShipsById = new Map<number, Map<number, number>>();
  const statsById = new Map<number, ReplayPlayerStats>();
  let hasStats = false;
  const frames: ReplayFrame[] = [];
  const turnMarkers: ReplayTurnMarker[] = [];
  const chat: ReplayChatMessage[] = [];
  const emoji: ReplayEmoji[] = [];

  for (const entry of replay.frames) {
    if (entry.kind === 'action') {
      for (const delta of entry.mapDelta) {
        if (!players.has(delta.ownerId)) territoryById.delete(delta.id);
        else territoryById.set(delta.id, { ...delta });
      }
      for (const shipDelta of entry.seaShipsDelta ?? []) {
        const byPlayer =
          seaShipsById.get(shipDelta.seaTerritoryId) ?? new Map();
        if (shipDelta.ships <= 0) byPlayer.delete(shipDelta.playerId);
        else byPlayer.set(shipDelta.playerId, shipDelta.ships);
        if (byPlayer.size === 0) seaShipsById.delete(shipDelta.seaTerritoryId);
        else seaShipsById.set(shipDelta.seaTerritoryId, byPlayer);
      }
      if (entry.statsDelta) hasStats = true;
      for (const stats of entry.statsDelta ?? [])
        statsById.set(stats.playerId, stats);
      const animation =
        entry.animation.type === 'attack' && entry.animation.defenderId == null
          ? { ...entry.animation, defenderId: undefined }
          : entry.animation;
      frames.push({
        territories: [...territoryById.values()].map((t) => ({ ...t })),
        toxinTerritories: entry.toxinTerritories,
        radiationTerritories: entry.radiationTerritories,
        radiationUpcoming: entry.radiationUpcoming ?? [],
        seaShips: [...seaShipsById.entries()].flatMap(
          ([seaTerritoryId, byPlayer]) =>
            [...byPlayer.entries()].map(([playerId, ships]) => ({
              seaTerritoryId,
              playerId,
              ships,
            })),
        ),
        hands: entry.hands ?? [],
        playerStates: entry.playerStates ?? [],
        playerStats: [...statsById.values()],
        turnPhase: entry.turnPhase,
        animation,
        roundNumber: entry.roundNumber,
        playerId: entry.playerId,
      });
    } else if (entry.kind === 'turn') {
      turnMarkers.push({
        afterFrame: frames.length,
        playerId: entry.playerId,
        roundNumber: entry.roundNumber,
      });
    } else if (entry.kind === 'chat') {
      chat.push({
        afterFrame: frames.length,
        senderId: entry.senderId,
        name: entry.name,
        message: entry.message,
      });
    } else {
      emoji.push({
        afterFrame: frames.length,
        senderId: entry.senderId,
        targetPlayerId: entry.targetPlayerId,
        emoji: entry.emoji,
      });
    }
  }

  return {
    data: {
      initial: replay.initialTerritories,
      initialRadiation: replay.initialRadiation,
      frames,
      log: serverLog.map((e) => ({ ...e, afterFrame: e.afterFrame ?? 0 })),
    },
    turnMarkers,
    chat,
    emoji,
    hasStats,
  };
}

export interface ReplayPlayerCounts {
  territoryCount: number;
  troopCount: number;
  capitalCount: number;
  cardCount: number;
}

export function replayPlayerCounts(
  territories: ReplayTerritory[],
  hands: ReplayHand[],
  capitalTerritoryIds: Set<number>,
): Map<number, ReplayPlayerCounts> {
  const counts = new Map<number, ReplayPlayerCounts>();
  const entry = (playerId: number) => {
    let count = counts.get(playerId);
    if (!count) {
      count = {
        territoryCount: 0,
        troopCount: 0,
        capitalCount: 0,
        cardCount: 0,
      };
      counts.set(playerId, count);
    }
    return count;
  };
  for (const territory of territories) {
    const count = entry(territory.ownerId);
    count.territoryCount += 1;
    count.troopCount += territory.troops;
    if (capitalTerritoryIds.has(territory.id)) count.capitalCount += 1;
  }
  for (const hand of hands) entry(hand.playerId).cardCount = hand.cards.length;
  return counts;
}

export interface ConquestArrow {
  fromTerritoryId: number;
  toTerritoryId: number;
}

export function conquestArrowAt(
  replay: ReplayData,
  index: number,
): ConquestArrow | null {
  if (index <= 0) return null;
  const frame = replay.frames[index - 1];
  if (frame.animation.type === 'attack') {
    const next = replay.frames[index];
    if (
      next?.animation.type === 'fortify' &&
      next.animation.fromTerritoryId === frame.animation.attackingTerritoryId &&
      next.animation.toTerritoryId === frame.animation.defendingTerritoryId
    ) {
      return {
        fromTerritoryId: frame.animation.attackingTerritoryId,
        toTerritoryId: frame.animation.defendingTerritoryId,
      };
    }
    return null;
  }
  if (frame.animation.type === 'fortify' && index >= 2) {
    const prev = replay.frames[index - 2];
    if (
      prev.animation.type === 'attack' &&
      prev.animation.attackingTerritoryId === frame.animation.fromTerritoryId &&
      prev.animation.defendingTerritoryId === frame.animation.toTerritoryId
    ) {
      return {
        fromTerritoryId: frame.animation.fromTerritoryId,
        toTerritoryId: frame.animation.toTerritoryId,
      };
    }
  }
  return null;
}

export function replayStops(frames: ReplayFrame[]) {
  const turnStops: number[] = [];
  const roundStops: number[] = [];
  frames.forEach((frame, i) => {
    const previous = frames[i - 1];
    const newRound = !previous || previous.roundNumber !== frame.roundNumber;
    if (newRound) roundStops.push(i + 1);
    if (newRound || previous.playerId !== frame.playerId) turnStops.push(i + 1);
  });
  return { turnStops, roundStops };
}

export function unlockedTilesAt(replay: ReplayData, index: number): number[] {
  return replay.frames
    .slice(0, index)
    .flatMap((f) =>
      f.animation.type === 'unlock' ? [f.animation.tileId] : [],
    );
}

export function switchFlipsAt(replay: ReplayData, index: number): number[] {
  return replay.frames
    .slice(0, index)
    .flatMap((f) =>
      f.animation.type === 'switch' ? [f.animation.switchId] : [],
    );
}

export function frameSounds(replay: ReplayData, index: number): string[] {
  const sounds: string[] = [];
  const frame = replay.frames[index];
  const previous = index > 0 ? replay.frames[index - 1] : null;
  const animation = frame.animation;
  const previousTerritories = previous?.territories ?? replay.initial;
  if (
    animation.type === 'deploy' &&
    !previousTerritories.some((t) => t.id === animation.territoryId)
  )
    sounds.push('select');
  const previousRadiation =
    previous?.radiationTerritories ?? replay.initialRadiation;
  if (frame.radiationTerritories.some((id) => !previousRadiation.includes(id)))
    sounds.push('radiation');
  if (index === replay.frames.length - 1) {
    sounds.push('end');
    return sounds;
  }
  const previousStates = new Map(
    (previous?.playerStates ?? []).map((s) => [s.playerId, s]),
  );
  const newlyEliminated = frame.playerStates.some(
    (s) =>
      s.eliminated &&
      !s.surrendered &&
      !previousStates.get(s.playerId)?.eliminated,
  );
  const newlySurrendered = frame.playerStates.some(
    (s) => s.surrendered && !previousStates.get(s.playerId)?.surrendered,
  );
  const connectionChanges = frame.playerStates
    .filter((s) => {
      const before = previousStates.get(s.playerId)?.connected;
      return (
        before !== undefined &&
        s.connected !== undefined &&
        s.connected !== before
      );
    })
    .map((s) => s.connected);
  const phaseChanged =
    previous !== null &&
    (previous.turnPhase !== frame.turnPhase ||
      (frame.turnPhase === 'deploy' && previous.playerId !== frame.playerId));
  if (newlyEliminated) sounds.push('bell');
  if (newlySurrendered) sounds.push('surrender');
  if (connectionChanges.includes(true)) sounds.push('connect');
  if (connectionChanges.includes(false)) sounds.push('disconnect');
  if (phaseChanged) sounds.push('phase');
  return sounds;
}

function playFrameSounds(replay: ReplayData, index: number) {
  for (const sound of frameSounds(replay, index)) playSound(sound);
}

export function useReplay(
  replay: ReplayData | null,
  onEnterFrame: (
    animation: ReplayAnimation,
    partOfConquestPair: boolean,
  ) => void,
) {
  const [index, setIndex] = useState(() => replay?.frames.length ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const indexRef = useRef(index);

  useLayoutEffect(() => {
    indexRef.current = index;
  });

  const totalFrames = replay?.frames.length ?? 0;

  const { turnStops, roundStops } = useMemo(
    () => replayStops(replay?.frames ?? []),
    [replay],
  );

  const stepForward = useCallback(() => {
    const current = indexRef.current;
    if (!replay || current >= totalFrames) return;
    const next = current + 1;
    indexRef.current = next;
    onEnterFrame(
      replay.frames[current].animation,
      conquestArrowAt(replay, next) !== null,
    );
    playFrameSounds(replay, current);
    setIndex(next);
    if (next >= totalFrames) setPlaying(false);
  }, [replay, totalFrames, onEnterFrame]);

  function stepBackward() {
    setPlaying(false);
    setIndex((i) => Math.max(0, i - 1));
  }

  function jumpToStart() {
    setPlaying(false);
    setIndex(0);
  }

  function jumpToEnd() {
    setPlaying(false);
    setIndex(totalFrames);
  }

  function seek(value: number) {
    const next = Math.max(0, Math.min(totalFrames, value));
    indexRef.current = next;
    setPlaying(false);
    setIndex(next);
  }

  function move(direction: 1 | -1, unit: ReplayMoveUnit) {
    const current = indexRef.current;
    const stops = unit === 'turn' ? turnStops : roundStops;
    const target =
      unit === 'frame'
        ? current + direction
        : direction > 0
          ? (stops.find((stop) => stop > current) ?? totalFrames)
          : (stops.findLast((stop) => stop < current) ?? 0);
    if (target < 0 || target > totalFrames || target === current) return;
    playSound('click');
    if (target === current + 1) stepForward();
    else seek(target);
  }

  function togglePlay() {
    if (index >= totalFrames) setIndex(0);
    setPlaying((p) => !p);
  }

  function cycleSpeed() {
    const i = REPLAY_SPEEDS.indexOf(speed);
    setSpeed(REPLAY_SPEEDS[(i + 1) % REPLAY_SPEEDS.length]);
  }

  useEffect(() => {
    if (!playing || !replay || index >= totalFrames) return;
    const timer = setTimeout(stepForward, BASE_FRAME_INTERVAL_MS / speed);
    return () => clearTimeout(timer);
  }, [playing, index, speed, replay, stepForward, totalFrames]);

  const currentFrame = replay
    ? index <= 0
      ? replay.frames[0]
      : replay.frames[index - 1]
    : undefined;

  const territories = replay
    ? index <= 0
      ? replay.initial
      : replay.frames[index - 1].territories
    : null;
  const toxinTerritories = replay
    ? index <= 0
      ? []
      : replay.frames[index - 1].toxinTerritories
    : null;
  const radiationTerritories = replay
    ? index <= 0
      ? replay.initialRadiation
      : replay.frames[index - 1].radiationTerritories
    : null;
  const radiationUpcoming = replay
    ? index <= 0
      ? []
      : replay.frames[index - 1].radiationUpcoming
    : null;
  const seas = replay
    ? groupSeaShips(index <= 0 ? [] : replay.frames[index - 1].seaShips)
    : null;
  const hands = replay
    ? index <= 0
      ? []
      : replay.frames[index - 1].hands
    : null;
  const playerStates = replay
    ? ((index <= 0 ? replay.frames[0] : replay.frames[index - 1])
        ?.playerStates ?? [])
    : null;
  const unlockedTileIds = replay ? unlockedTilesAt(replay, index) : null;
  const switchFlips = replay ? switchFlipsAt(replay, index) : null;

  return {
    index,
    totalFrames,
    playing,
    speed,
    territories,
    toxinTerritories,
    radiationTerritories,
    radiationUpcoming,
    seas,
    hands,
    playerStates,
    unlockedTileIds,
    switchFlips,
    log: replay ? replay.log : null,
    turnPhase: currentFrame ? currentFrame.turnPhase : null,
    roundNumber: currentFrame ? currentFrame.roundNumber : null,
    turnPlayerId: currentFrame ? currentFrame.playerId : null,
    conquestArrow:
      replay && index < totalFrames ? conquestArrowAt(replay, index) : null,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    seek,
    move,
    roundStops,
    togglePlay,
    cycleSpeed,
  };
}
