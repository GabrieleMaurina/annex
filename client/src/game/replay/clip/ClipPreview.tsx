import { useEffect, useMemo, useRef, useState } from 'react';
import { useWhiteIcon } from '../../../common/icon';
import type { GameState } from '../../../lib/types';
import type { EndCard } from '../../endCard/endCard';
import type { ReplayData } from '../replay';
import { ANIMATION_WINDOW_MS } from './clipFrames';
import { clipSize, createClipSession, type ClipSession } from './clipRenderer';
import type { ClipScene } from './clipScene';

const PREVIEW_WIDTH = 800;
const PREVIEW_FRAME_MS = 33;

interface Props {
  scene: ClipScene;
  game: GameState;
  replay: ReplayData;
  indices: number[];
  durations: number[];
  endCard: EndCard | null;
  animate: boolean;
  showRound: boolean;
  scrubIndex: number | null;
  paused: boolean;
  seek: { index: number } | null;
  onFrame: (index: number) => void;
}

function ClipPreview({
  scene,
  game,
  replay,
  indices,
  durations,
  endCard,
  animate,
  showRound,
  scrubIndex,
  paused,
  seek,
  onFrame,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ClipSession | null>(null);
  const seekRef = useRef<{ index: number } | null>(null);
  const userPausedRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const whitePlayIcon = useWhiteIcon('/icons/play.svg');
  const stepDurations = useMemo(
    () => durations.map((d) => Math.min(d, ANIMATION_WINDOW_MS)),
    [durations],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sessionRef.current = createClipSession(
      scene,
      game,
      replay,
      canvas,
      clipSize(scene, PREVIEW_WIDTH),
    );
  }, [scene, game, replay]);

  useEffect(() => {
    seekRef.current = seek;
  }, [seek]);

  useEffect(() => {
    userPausedRef.current = userPaused;
  }, [userPaused]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || paused) return;
    session.timeline(indices, stepDurations, endCard, animate);
    if (scrubIndex !== null) {
      session.stillAt(scrubIndex, showRound);
      return;
    }
    let position = 0;
    let stepStart = performance.now();
    let pauseStart: number | null = null;
    let lastDraw = -Infinity;
    let frame = 0;
    let held = false;
    const active: ClipSession = session;
    const cycle = stepDurations.reduce((sum, d) => sum + d, 0);
    active.begin(0, showRound);
    onFrame(indices[0]);

    function tick(now: number) {
      let seeked = false;
      const requested = seekRef.current;
      if (requested) {
        seekRef.current = null;
        const outside =
          requested.index < indices[0] ||
          requested.index > indices[indices.length - 1];
        if (outside) {
          held = true;
          active.stillAt(requested.index, showRound);
          onFrame(requested.index);
          frame = requestAnimationFrame(tick);
          return;
        }
        held = false;
        const target = indices.findIndex((i) => i >= requested.index);
        position = target === -1 ? indices.length - 1 : target;
        stepStart = now;
        pauseStart = null;
        active.begin(Math.max(0, position - 1), showRound);
        onFrame(indices[position]);
        seeked = true;
      }
      if (userPausedRef.current) {
        pauseStart ??= now;
        if (seeked) active.play(position, 0, showRound);
        frame = requestAnimationFrame(tick);
        return;
      }
      if (pauseStart !== null) {
        stepStart += now - pauseStart;
        pauseStart = null;
      }
      if (held) {
        frame = requestAnimationFrame(tick);
        return;
      }
      stepStart += Math.max(0, Math.floor((now - stepStart) / cycle)) * cycle;
      while (now - stepStart >= stepDurations[position]) {
        stepStart += stepDurations[position];
        position += 1;
        if (position >= indices.length) {
          position = 0;
          active.begin(0, showRound);
        }
        onFrame(indices[position]);
      }
      if (now - lastDraw >= PREVIEW_FRAME_MS) {
        active.play(position, now - stepStart, showRound);
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    indices,
    stepDurations,
    endCard,
    animate,
    showRound,
    scrubIndex,
    paused,
    onFrame,
  ]);

  return (
    <div
      className="position-relative"
      role="button"
      onClick={() => setUserPaused((value) => !value)}
    >
      <canvas ref={canvasRef} className="d-block w-100 rounded" />
      {userPaused && (
        <div className="position-absolute top-50 start-50 translate-middle d-flex align-items-center justify-content-center rounded-circle bg-dark bg-opacity-50 p-3 pe-none">
          <img
            src={whitePlayIcon ?? '/icons/play.svg'}
            width={32}
            height={32}
            alt="Paused"
          />
        </div>
      )}
    </div>
  );
}

export default ClipPreview;
