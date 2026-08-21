import { useCallback, useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import type {
  ReplayAck,
  ReplayAnimation,
  ReplayFrame,
  ReplayTerritory,
} from '../lib/types';

export const REPLAY_SPEEDS = [0.5, 1, 2, 4];
const BASE_FRAME_INTERVAL_MS = 800;

interface ReplayData {
  initial: ReplayTerritory[];
  frames: ReplayFrame[];
}

export interface ConquestArrow {
  fromTerritoryId: number;
  toTerritoryId: number;
}

// A conquering attack frame and the movement frame right after it (the
// troops moving into the just-conquered territory) are a matched pair — see
// PROTOCOL.md. While sitting on either one, the attack arrow should read as
// a single continuous arrow spanning both, not two separate one-shot ones.
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
  gameEnded: boolean,
  onEnterFrame: (
    animation: ReplayAnimation,
    partOfConquestPair: boolean,
  ) => void,
) {
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!gameEnded) return;
    socket.emit('game:replay', (res: ReplayAck) => {
      if (!res.ok) return;
      setReplay({ initial: res.initial, frames: res.frames });
      setIndex(res.frames.length);
    });
  }, [gameEnded]);

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

  // While sitting exactly on a conquering attack frame, the conquered
  // territory's snapshot troops are still 0 — the move-in only happens in
  // the paired frame right after. Mirror how a non-attacking live client
  // displays that same gap: show the troops the territory is about to end
  // up with (here, known exactly, since the paired frame already happened).
  let territories = replay
    ? index <= 0
      ? replay.initial
      : replay.frames[index - 1].territories
    : null;
  if (replay && index > 0) {
    const frame = replay.frames[index - 1];
    if (frame.animation.type === 'attack') {
      const { defendingTerritoryId, attackerId } = frame.animation;
      const conquered = frame.territories.find(
        (t) => t.id === defendingTerritoryId,
      );
      const nextFrame = replay.frames[index];
      if (
        conquered?.ownerId === attackerId &&
        nextFrame?.animation.type === 'fortify' &&
        nextFrame.animation.toTerritoryId === defendingTerritoryId
      ) {
        const moveInTroops = nextFrame.animation.troops;
        territories = territories!.map((t) =>
          t.id === defendingTerritoryId ? { ...t, troops: moveInTroops } : t,
        );
      }
    }
  }

  return {
    index,
    totalFrames,
    playing,
    speed,
    territories,
    turnNumber: currentFrame ? currentFrame.turnNumber : null,
    turnPlayerId: currentFrame ? currentFrame.playerId : null,
    conquestArrow: replay ? conquestArrowAt(replay, index) : null,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    seek,
    togglePlay,
    cycleSpeed,
  };
}
