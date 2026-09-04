import { useCallback, useEffect, useState } from 'react';
import { connector } from '../connector';
import type {
  ReplayAck,
  ReplayAnimation,
  ReplayFrame,
  ReplayHand,
  ReplayTerritory,
  StoredGame,
} from '../lib/types';

export const REPLAY_SPEEDS = [0.5, 1, 2, 4];
const BASE_FRAME_INTERVAL_MS = 800;

export interface ReplayData {
  initial: ReplayTerritory[];
  initialRadiation: number[];
  frames: ReplayFrame[];
}

export type ReplaySource =
  | { kind: 'live'; enabled: boolean }
  | { kind: 'static'; data: ReplayData | null };

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
}

export function foldStoredReplay(replay: StoredGame['replay']): FoldedReplay {
  const territoryById = new Map(
    replay.initialTerritories.map((t) => [t.id, { ...t }]),
  );
  const frames: ReplayFrame[] = [];
  const turnMarkers: ReplayTurnMarker[] = [];
  const chat: ReplayChatMessage[] = [];
  const emoji: ReplayEmoji[] = [];

  for (const entry of replay.frames) {
    if (entry.kind === 'action') {
      for (const delta of entry.mapDelta)
        territoryById.set(delta.id, { ...delta });
      const animation =
        entry.animation.type === 'attack' && entry.animation.defenderId == null
          ? { ...entry.animation, defenderId: undefined }
          : entry.animation;
      frames.push({
        territories: [...territoryById.values()].map((t) => ({ ...t })),
        toxinTerritories: entry.toxinTerritories,
        radiationTerritories: entry.radiationTerritories,
        radiationUpcoming: entry.radiationUpcoming ?? [],
        hands: entry.hands ?? [],
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
    },
    turnMarkers,
    chat,
    emoji,
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

function conquestArrowAt(
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

export function useReplay(
  source: ReplaySource,
  onEnterFrame: (
    animation: ReplayAnimation,
    partOfConquestPair: boolean,
  ) => void,
) {
  const staticData = source.kind === 'static' ? source.data : null;
  const liveEnabled = source.kind === 'live' && source.enabled;

  const [liveReplay, setLiveReplay] = useState<ReplayData | null>(null);
  const replay = staticData ?? liveReplay;
  const [index, setIndex] = useState(() => staticData?.frames.length ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (staticData || !liveEnabled) return;
    connector.replay((res: ReplayAck) => {
      if (!res.ok) return;
      setLiveReplay({
        initial: res.initial,
        initialRadiation: res.initialRadiation,
        frames: res.frames,
      });
      setIndex(res.frames.length);
    });
  }, [staticData, liveEnabled]);

  const totalFrames = replay?.frames.length ?? 0;

  const stepForward = useCallback(() => {
    if (!replay || index >= totalFrames) return;
    const next = index + 1;
    onEnterFrame(
      replay.frames[index].animation,
      conquestArrowAt(replay, next) !== null,
    );
    setIndex(next);
    if (next >= totalFrames) setPlaying(false);
  }, [replay, index, totalFrames, onEnterFrame]);

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
    setPlaying(false);
    setIndex(Math.max(0, Math.min(totalFrames, value)));
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
  const hands = replay
    ? index <= 0
      ? []
      : replay.frames[index - 1].hands
    : null;

  return {
    index,
    totalFrames,
    playing,
    speed,
    territories,
    toxinTerritories,
    radiationTerritories,
    radiationUpcoming,
    hands,
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
    togglePlay,
    cycleSpeed,
  };
}
