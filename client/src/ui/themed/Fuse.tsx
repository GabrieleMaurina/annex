import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef } from 'react';

const HOT_SECONDS = 10;

interface Props {
  startedAt: number;
  duration: number;
  color: string;
  paused: boolean;
}

function restart(
  el: HTMLElement,
  name: string,
  seconds: number,
  delay: number,
) {
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = `${name} ${seconds}s linear ${delay}s both`;
}

function Fuse({ startedAt, duration, color, paused }: Props) {
  const burnRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const heatRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const burn = burnRef.current;
    const head = headRef.current;
    const heat = heatRef.current;
    if (!burn || !head || !heat) return;
    const elapsed = Math.max(0, Date.now() - startedAt) / 1000;
    const heatSeconds = Math.min(HOT_SECONDS, duration);
    restart(burn, 'fuse-burn', duration, -elapsed);
    restart(head, 'fuse-travel', duration, -elapsed);
    restart(heat, 'fuse-heat', heatSeconds, duration - heatSeconds - elapsed);
  }, [startedAt, duration]);

  useLayoutEffect(() => {
    [burnRef, headRef, heatRef].forEach(({ current }) => {
      if (current)
        current.style.animationPlayState = paused ? 'paused' : 'running';
    });
  }, [startedAt, duration, paused]);

  return (
    <div className="fuse" style={{ '--fuse-color': color } as CSSProperties}>
      <div ref={burnRef} className="fuse-burned" />
      <div ref={headRef} className="fuse-head">
        <div ref={heatRef} className="fuse-heat">
          <div className="fuse-spark" />
        </div>
      </div>
    </div>
  );
}

export default Fuse;
