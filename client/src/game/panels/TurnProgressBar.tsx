import { useEffect, useLayoutEffect, useRef } from 'react';
import { playSound } from '../../lib/sounds';

const HEARTBEAT_SECONDS = 5;

interface Props {
  turnStartedAt: number;
  turnDuration: number;
  color: string;
  paused: boolean;
  heartbeat?: boolean;
}

function TurnProgressBar({
  turnStartedAt,
  turnDuration,
  color,
  paused,
  heartbeat = false,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heartbeat || paused) return;
    const remainingMs = turnStartedAt + turnDuration * 1000 - Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let second = HEARTBEAT_SECONDS; second > 0; second--) {
      const delay = remainingMs - second * 1000;
      if (delay >= 0)
        timers.push(setTimeout(() => playSound('heartbeat'), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [heartbeat, paused, turnStartedAt, turnDuration]);

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
      className="position-fixed top-0 start-0 end-0 pe-none"
      style={{ height: 4, zIndex: 2 }}
    >
      <style>{`
        @keyframes annexTurnProgress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
      <div
        ref={barRef}
        style={{
          height: '100%',
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export default TurnProgressBar;
