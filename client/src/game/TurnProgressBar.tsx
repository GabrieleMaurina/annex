import { useLayoutEffect, useRef } from 'react';

interface Props {
  turnStartedAt: number;
  turnDuration: number;
  color: string;
  paused: boolean;
}

function TurnProgressBar({
  turnStartedAt,
  turnDuration,
  color,
  paused,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const elapsed = Math.max(0, Date.now() - turnStartedAt) / 1000;
    bar.style.animation = 'none';
    void bar.offsetHeight;
    bar.style.animation = `annexTurnProgress ${turnDuration}s linear forwards`;
    bar.style.animationDelay = `-${elapsed}s`;
    bar.style.animationPlayState = paused ? 'paused' : 'running';
  }, [turnStartedAt, turnDuration, paused]);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.animationPlayState = paused ? 'paused' : 'running';
  }, [paused]);

  return (
    <div
      className="position-fixed top-0 start-0 end-0"
      style={{ height: 4, zIndex: 2 }}
    >
      <style>{`
        @keyframes annexTurnProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      <div
        ref={barRef}
        style={{ height: '100%', width: '0%', backgroundColor: color }}
      />
    </div>
  );
}

export default TurnProgressBar;
