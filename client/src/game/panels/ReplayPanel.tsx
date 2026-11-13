import { useEffect, useLayoutEffect, useRef } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useWhiteIcon } from '../../common/icon';
import {
  DRAG_THRESHOLD,
  PIXELS_PER_STEP,
  wheelDirection,
} from '../../common/inputs/useNumberInput';
import Tip from '../../common/tooltips/Tip';
import { playSound } from '../../lib/sounds';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../ui/containers/panelStyle';
import { isTypingTarget } from '../GameMap/helpers';
import { REPLAY_SPEEDS, type ReplayMoveUnit } from '../replay/replay';

const SLIDER_WIDTH = 260;
const MIN_TICK_SPACING = 4;

function moveUnit(e: { ctrlKey: boolean; shiftKey: boolean }): ReplayMoveUnit {
  return e.shiftKey ? 'round' : e.ctrlKey ? 'turn' : 'frame';
}

function arrowDirection(key: string): 1 | -1 | 0 {
  if (key === 'ArrowUp' || key === 'ArrowRight') return 1;
  if (key === 'ArrowDown' || key === 'ArrowLeft') return -1;
  return 0;
}

interface Props {
  index: number;
  totalFrames: number;
  playing: boolean;
  speed: number;
  roundNumber: number;
  color: string;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
  onSeek: (index: number) => void;
  onMove: (direction: 1 | -1, unit: ReplayMoveUnit) => void;
  roundStops: number[];
  onCycleSpeed: () => void;
}

function ReplayPanel({
  index,
  totalFrames,
  playing,
  speed,
  roundNumber,
  color,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onJumpStart,
  onJumpEnd,
  onSeek,
  onMove,
  roundStops,
  onCycleSpeed,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    steps: number;
    dragging: boolean;
  } | null>(null);
  const onMoveRef = useRef(onMove);
  const onTogglePlayRef = useRef(onTogglePlay);
  const whitePlayIcon = useWhiteIcon('/icons/play.svg');
  const whitePauseIcon = useWhiteIcon('/icons/pause.svg');
  const whiteSkipBackIcon = useWhiteIcon('/icons/skip-back.svg');
  const whiteSkipForwardIcon = useWhiteIcon('/icons/skip-forward.svg');
  const whiteStepBackIcon = useWhiteIcon('/icons/step-back.svg');
  const whiteStepForwardIcon = useWhiteIcon('/icons/step-forward.svg');

  const atStart = index <= 0;
  const atEnd = index >= totalFrames;
  const progress = totalFrames > 0 ? (index / totalFrames) * 100 : 0;
  const tickEvery = Math.ceil(
    (roundStops.length * MIN_TICK_SPACING) / SLIDER_WIDTH,
  );
  const roundTicks = roundStops.filter((_, i) => i % tickEvery === 0);

  useLayoutEffect(() => {
    onMoveRef.current = onMove;
    onTogglePlayRef.current = onTogglePlay;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.metaKey) return;
      if (e.target instanceof Element && e.target.closest('.modal')) return;
      if (isTypingTarget(e.target) && e.target !== rangeRef.current) return;
      if (e.key === ' ') {
        e.preventDefault();
        playSound('click');
        onTogglePlayRef.current();
        return;
      }
      const direction = arrowDirection(e.key);
      if (direction === 0) return;
      e.preventDefault();
      onMoveRef.current(direction, moveUnit(e));
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();
      onMoveRef.current(wheelDirection(e), moveUnit(e));
    }
    window.addEventListener('keydown', onKeyDown);
    panel.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      panel.removeEventListener('wheel', onWheel);
    };
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || e.target === rangeRef.current) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      steps: 0,
      dragging: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = drag.startY - e.clientY;
    if (!drag.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return;
      drag.dragging = true;
      e.currentTarget.setPointerCapture(drag.pointerId);
    }
    const steps = Math.round((dx + dy) / PIXELS_PER_STEP);
    const direction = steps > drag.steps ? 1 : -1;
    for (let i = drag.steps; i !== steps; i += direction)
      onMove(direction, moveUnit(e));
    drag.steps = steps;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.dragging && e.currentTarget.hasPointerCapture(drag.pointerId))
      e.currentTarget.releasePointerCapture(drag.pointerId);
    dragRef.current = null;
  }

  return (
    <div
      className={`position-fixed bottom-0 start-50 translate-middle-x m-3 py-2 px-3 d-flex align-items-center gap-2 ${PANEL_BG_CLASS} ${PANEL_CLASS}`}
      ref={panelRef}
      style={{
        zIndex: 1,
        touchAction: 'none',
        width: 'max-content',
        maxWidth: 'calc(100vw - 2rem)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <style>{`
        .replay-range::-webkit-slider-runnable-track {
          background: linear-gradient(
            to right,
            var(--bs-primary) var(--replay-progress),
            var(--bs-secondary-bg) var(--replay-progress)
          );
        }
        .replay-range::-moz-range-track {
          background: var(--bs-secondary-bg);
        }
        .replay-range::-moz-range-progress {
          height: 0.5rem;
          background: var(--bs-primary);
          border-radius: 1rem;
        }
      `}</style>
      <Tip text="Current player">
        <span
          className="d-inline-block rounded-circle flex-shrink-0"
          style={{ width: 22, height: 22, backgroundColor: color }}
        />
      </Tip>
      <span className="fw-bold text-nowrap flex-shrink-0">
        Round {roundNumber}
      </span>
      <Tip text="Jump to start">
        <Button
          className="d-flex align-items-center justify-content-center"
          size="sm"
          variant="secondary"
          disabled={atStart}
          onClick={onJumpStart}
        >
          <img
            src={whiteSkipBackIcon ?? '/icons/skip-back.svg'}
            width={14}
            height={14}
            alt="Jump to start"
          />
        </Button>
      </Tip>
      <Tip text="Rewind one frame">
        <Button
          className="d-flex align-items-center justify-content-center"
          size="sm"
          variant="secondary"
          disabled={atStart}
          onClick={onStepBack}
        >
          <img
            src={whiteStepBackIcon ?? '/icons/step-back.svg'}
            width={14}
            height={14}
            alt="Rewind one frame"
          />
        </Button>
      </Tip>
      <Tip text={playing ? 'Pause (Space)' : 'Play (Space)'}>
        <Button
          className="d-flex align-items-center justify-content-center"
          size="sm"
          variant="secondary"
          onClick={onTogglePlay}
        >
          <img
            src={
              playing
                ? (whitePauseIcon ?? '/icons/pause.svg')
                : (whitePlayIcon ?? '/icons/play.svg')
            }
            width={14}
            height={14}
            alt={playing ? 'Pause' : 'Play'}
          />
        </Button>
      </Tip>
      <Tip text="Advance one frame">
        <Button
          className="d-flex align-items-center justify-content-center"
          size="sm"
          variant="secondary"
          disabled={atEnd}
          onClick={onStepForward}
        >
          <img
            src={whiteStepForwardIcon ?? '/icons/step-forward.svg'}
            width={14}
            height={14}
            alt="Advance one frame"
          />
        </Button>
      </Tip>
      <Tip text="Jump to end">
        <Button
          className="d-flex align-items-center justify-content-center"
          size="sm"
          variant="secondary"
          disabled={atEnd}
          onClick={onJumpEnd}
        >
          <img
            src={whiteSkipForwardIcon ?? '/icons/skip-forward.svg'}
            width={14}
            height={14}
            alt="Jump to end"
          />
        </Button>
      </Tip>
      <div className="position-relative" style={{ width: SLIDER_WIDTH }}>
        {totalFrames > 0 &&
          roundTicks.map((stop) => (
            <span
              key={stop}
              className="position-absolute bg-secondary"
              style={{
                top: '0.25rem',
                width: 1,
                height: '1rem',
                left: `calc(0.5rem + (100% - 1rem) * ${stop / totalFrames})`,
              }}
            />
          ))}
        <Form.Range
          ref={rangeRef}
          className="replay-range position-relative d-block"
          min={0}
          max={totalFrames}
          value={index}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={
            {
              '--replay-progress': `${progress}%`,
            } as React.CSSProperties
          }
        />
      </div>
      <Tip text="Arrows, wheel or drag to step. Ctrl: by turn, Shift: by round">
        <span className="text-nowrap">
          {index}/{totalFrames}
        </span>
      </Tip>
      <Tip
        text={`Playback speed. Click for ${REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(speed) + 1) % REPLAY_SPEEDS.length]}x`}
      >
        <Button
          size="sm"
          variant="secondary"
          onClick={onCycleSpeed}
          style={{ minWidth: 44 }}
        >
          {speed}x
        </Button>
      </Tip>
    </div>
  );
}

export default ReplayPanel;
