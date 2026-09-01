import { Button, Form } from 'react-bootstrap';
import Tip from '../../common/Tip';
import { useWhiteIcon } from '../../common/icon';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';

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
  onCycleSpeed,
}: Props) {
  const whitePlayIcon = useWhiteIcon('/icons/play.svg');
  const whitePauseIcon = useWhiteIcon('/icons/pause.svg');
  const whiteSkipBackIcon = useWhiteIcon('/icons/skip-back.svg');
  const whiteSkipForwardIcon = useWhiteIcon('/icons/skip-forward.svg');
  const whiteStepBackIcon = useWhiteIcon('/icons/step-back.svg');
  const whiteStepForwardIcon = useWhiteIcon('/icons/step-forward.svg');

  const atStart = index <= 0;
  const atEnd = index >= totalFrames;
  const progress = totalFrames > 0 ? (index / totalFrames) * 100 : 0;

  return (
    <div
      className={`position-fixed bottom-0 start-50 translate-middle-x m-3 py-2 px-3 d-flex align-items-center gap-2 ${PANEL_BG_CLASS} ${PANEL_CLASS}`}
      style={{ zIndex: 1 }}
    >
      <style>{`
        .replay-range::-webkit-slider-runnable-track {
          background: linear-gradient(
            to right,
            #0d6efd var(--replay-progress),
            var(--bs-secondary-bg) var(--replay-progress)
          );
        }
        .replay-range::-moz-range-track {
          background: var(--bs-secondary-bg);
        }
        .replay-range::-moz-range-progress {
          height: 0.5rem;
          background: #0d6efd;
          border-radius: 1rem;
        }
      `}</style>
      <Tip text="Current player">
        <span
          className="d-inline-block rounded-circle flex-shrink-0"
          style={{ width: 22, height: 22, backgroundColor: color }}
        />
      </Tip>
      <span className="fw-bold">Round {roundNumber}</span>
      <Tip text="Jump to start">
        <Button
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
      <Tip text={playing ? 'Pause' : 'Play'}>
        <Button size="sm" variant="secondary" onClick={onTogglePlay}>
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
      <Form.Range
        className="replay-range"
        min={0}
        max={totalFrames}
        value={index}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={
          {
            width: 260,
            '--replay-progress': `${progress}%`,
          } as React.CSSProperties
        }
      />
      <span className="text-nowrap">
        {index}/{totalFrames}
      </span>
      <Tip text="Playback speed">
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
