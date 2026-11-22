import type { MouseEvent, ReactNode, SVGProps } from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useToggleSound } from '../../lib/sounds';

export interface ChartTip {
  id: string;
  title: ReactNode;
  rows: { label: string; value: ReactNode }[];
  marker: { x: number; y: number; color: string };
}

export interface ChartPoint {
  x: number;
  y: number;
  reachX: number;
  reachY: number;
}

type TipAt = (point: ChartPoint) => ChartTip | null;

interface Anchor {
  x: number;
  y: number;
  tip: ChartTip;
}

interface Binding {
  hover: (event: MouseEvent, tipAt: TipAt) => void;
  leave: () => void;
  lock: (event: MouseEvent, tipAt: TipAt) => void;
}

const OFFSET = 16;
const MARKER_SIZE = 14;
const MOUSE_REACH = 12;
const TOUCH_REACH = 28;

const BindingContext = createContext<Binding>({
  hover: () => {},
  leave: () => {},
  lock: () => {},
});

const ActiveContext = createContext(false);

interface AreaProps {
  children: ReactNode;
}

export function ChartTooltipArea({ children }: AreaProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Anchor | null>(null);
  const [locked, setLocked] = useState<Anchor | null>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  useToggleSound(locked !== null);

  useEffect(() => {
    if (!locked) return;
    const close = () => setLocked(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [locked]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => setAreaWidth(area.offsetWidth));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const binding = useMemo<Binding>(() => {
    const anchorAt = (event: MouseEvent, tipAt: TipAt): Anchor | null => {
      const rect = areaRef.current!.getBoundingClientRect();
      const reach =
        (event.nativeEvent as PointerEvent).pointerType === 'touch'
          ? TOUCH_REACH
          : MOUSE_REACH;
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const tip = tipAt({
        x,
        y,
        reachX: reach / rect.width,
        reachY: reach / rect.height,
      });
      return tip && { x, y, tip };
    };
    return {
      hover: (event, tipAt) => setHovered(anchorAt(event, tipAt)),
      leave: () => setHovered(null),
      lock: (event, tipAt) => {
        const anchor = anchorAt(event, tipAt);
        if (!anchor) return;
        event.stopPropagation();
        setLocked((current) =>
          current?.tip.id === anchor.tip.id ? null : anchor,
        );
      },
    };
  }, []);

  const shown = locked ?? hovered;

  useLayoutEffect(() => {
    const area = areaRef.current;
    const tooltip = tooltipRef.current;
    if (!area || !tooltip || !shown) return;
    const width = area.offsetWidth;
    const x = shown.x * width;
    const y = shown.y * area.offsetHeight;
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    const tipWidth = tooltip.offsetWidth;
    const tipHeight = tooltip.offsetHeight;
    const left = Math.max(0, Math.min(x - tipWidth / 2, width - tipWidth));
    const below = y + OFFSET;
    const bottom = area.getBoundingClientRect().top + below + tipHeight;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${bottom > window.innerHeight ? y - OFFSET - tipHeight : below}px`;
  }, [shown, areaWidth]);

  return (
    <BindingContext.Provider value={binding}>
      <ActiveContext.Provider value={hovered !== null}>
        <div ref={areaRef} className="position-relative">
          {children}
          {shown && (
            <div
              className="position-absolute translate-middle rounded-circle border border-2 border-white pe-none"
              style={{
                left: `${shown.tip.marker.x * 100}%`,
                top: `${shown.tip.marker.y * 100}%`,
                width: MARKER_SIZE,
                height: MARKER_SIZE,
                backgroundColor: shown.tip.marker.color,
              }}
            />
          )}
          {shown && (
            <div
              ref={tooltipRef}
              className={`position-absolute tooltip show help-tooltip ${locked ? '' : 'pe-none'}`}
            >
              <div className="tooltip-inner">
                <div className="fw-bold mb-1">{shown.tip.title}</div>
                {shown.tip.rows.map((row) => (
                  <div
                    key={row.label}
                    className="d-flex justify-content-between gap-3"
                  >
                    <span className="opacity-75">{row.label}</span>
                    <span>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ActiveContext.Provider>
    </BindingContext.Provider>
  );
}

interface HitProps extends Omit<
  SVGProps<SVGRectElement>,
  'onClick' | 'onPointerMove' | 'onPointerLeave'
> {
  tipAt: TipAt;
}

export function ChartHit({ tipAt, ...rect }: HitProps) {
  const binding = useContext(BindingContext);
  const active = useContext(ActiveContext);
  return (
    <rect
      {...rect}
      fill="transparent"
      role={active ? 'button' : undefined}
      aria-label={active ? 'Pin details' : undefined}
      onPointerMove={(event) => binding.hover(event, tipAt)}
      onPointerLeave={binding.leave}
      onClick={(event) => binding.lock(event, tipAt)}
    />
  );
}
