import { useEffect, useRef } from 'react';
import { areAnimationsDisabled } from '../../game/animations';

const BIG_TEETH = 12;
const SMALL_TEETH = 8;
const SPIN_DEGREES = 540;
const SPIN_OPTIONS: KeyframeAnimationOptions = {
  duration: 800,
  easing: 'cubic-bezier(.2,.8,.25,1)',
  fill: 'forwards',
};

function polar(radius: number, angle: number): [number, number] {
  return [Math.sin(angle) * radius, -Math.cos(angle) * radius];
}

function point(radius: number, angle: number): string {
  return polar(radius, angle)
    .map((n) => n.toFixed(2))
    .join(' ');
}

function circle([x, y]: [number, number], radius: number): string {
  return `M${x + radius} ${y}A${radius} ${radius} 0 1 0 ${x - radius} ${y}A${radius} ${radius} 0 1 0 ${x + radius} ${y}Z`;
}

function gearPath(teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const outline = Array.from({ length: teeth }, (_, i) => {
    const angle = i * step;
    return [
      point(38, angle),
      point(48, angle + step * 0.14),
      point(48, angle + step * 0.42),
      point(38, angle + step * 0.56),
    ].join('L');
  }).join('L');
  const holes = Array.from({ length: 5 }, (_, i) =>
    circle(polar(25, (i * Math.PI * 2) / 5), 6.5),
  ).join('');
  return `M${outline}Z${circle([0, 0], 11)}${holes}`;
}

const BIG_GEAR_PATH = gearPath(BIG_TEETH);
const SMALL_GEAR_PATH = gearPath(SMALL_TEETH);

function SpinningGears({ className = '' }: { className?: string }) {
  const bigRef = useRef<SVGSVGElement>(null);
  const smallRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const big = bigRef.current;
    const small = smallRef.current;
    const button = big?.closest('button');
    if (!big || !small || !button) return;
    let angle = 0;
    const spin = () => {
      if (areAnimationsDisabled()) return;
      const next = angle + SPIN_DEGREES;
      const ratio = BIG_TEETH / SMALL_TEETH;
      big.animate(
        [
          { transform: `rotate(${angle}deg)` },
          { transform: `rotate(${next}deg)` },
        ],
        SPIN_OPTIONS,
      );
      small.animate(
        [
          { transform: `rotate(${-angle * ratio}deg)` },
          { transform: `rotate(${-next * ratio}deg)` },
        ],
        SPIN_OPTIONS,
      );
      angle = next;
    };
    button.addEventListener('click', spin);
    return () => button.removeEventListener('click', spin);
  }, []);

  return (
    <span className={`spinning-gears ${className}`} aria-hidden="true">
      <svg
        ref={bigRef}
        viewBox="-50 -50 100 100"
        className="spinning-gears-big"
      >
        <path fillRule="evenodd" d={BIG_GEAR_PATH} />
      </svg>
      <svg
        ref={smallRef}
        viewBox="-50 -50 100 100"
        className="spinning-gears-small"
      >
        <path fillRule="evenodd" d={SMALL_GEAR_PATH} />
      </svg>
    </span>
  );
}

export default SpinningGears;
