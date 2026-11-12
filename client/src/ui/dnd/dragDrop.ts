import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { playSound } from '../../lib/sounds';

const DRAG_THRESHOLD = 4;
const IGNORED_TARGETS = 'input, textarea, select, .odometer';
const DRAGGING_CLASS = 'dnd-dragging';
const GLIDE_MS = 260;

export const GAP = 'gap' as const;

export interface DropHit {
  zone: string;
  index?: number;
}

export interface DragState<T> {
  item: T;
  x: number;
  y: number;
  hover: DropHit | null;
}

interface Target {
  zone: string;
  rect: DOMRect;
  item: boolean;
  exact: boolean;
  position: number;
}

export function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, true), 0);
}

function captureTargets(source: Element | null): Target[] {
  const targets: Target[] = [];
  const counts = new Map<string, number>();
  for (const el of document.querySelectorAll<HTMLElement>('[data-drop-zone]')) {
    if (el === source) continue;
    const zone = el.dataset.dropZone ?? '';
    const item = el.dataset.dropIndex !== undefined;
    const exact = el.dataset.dropExact !== undefined;
    const count = counts.get(zone) ?? 0;
    if (item) counts.set(zone, count + 1);
    targets.push({
      zone,
      rect: el.getBoundingClientRect(),
      item,
      exact,
      position: exact ? Number(el.dataset.dropIndex) : count,
    });
  }
  return targets;
}

function contains(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function distance(rect: DOMRect, x: number, y: number) {
  return Math.hypot(
    x - (rect.left + rect.width / 2),
    y - (rect.top + rect.height / 2),
  );
}

function insertionOf(target: Target, x: number) {
  if (target.exact) return target.position;
  const rect = target.rect;
  return target.position + (x > rect.left + rect.width / 2 ? 1 : 0);
}

function hitIn(targets: Target[], x: number, y: number): DropHit | null {
  let deepest: Target | undefined;
  for (const target of targets)
    if (contains(target.rect, x, y)) deepest = target;
  if (!deepest) return null;
  if (deepest.item)
    return { zone: deepest.zone, index: insertionOf(deepest, x) };
  let nearest: Target | undefined;
  let nearestDistance = Infinity;
  for (const target of targets) {
    if (!target.item || target.zone !== deepest.zone) continue;
    const d = distance(target.rect, x, y);
    if (d < nearestDistance) {
      nearest = target;
      nearestDistance = d;
    }
  }
  return {
    zone: deepest.zone,
    index: nearest ? insertionOf(nearest, x) : undefined,
  };
}

export function useDrag<T>() {
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const before = useRef<Map<string, DOMRect> | null>(null);
  const endDrag = useRef<() => void>(() => {});

  useEffect(() => () => endDrag.current(), []);

  useLayoutEffect(() => {
    const previous = before.current;
    before.current = null;
    if (
      !previous ||
      document.documentElement.classList.contains('animations-off')
    )
      return;
    elements.current.forEach((el, key) => {
      const old = previous.get(key);
      if (!old) return;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (dx === 0 && dy === 0) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: GLIDE_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    });
  });

  function snapshot() {
    before.current = new Map(
      [...elements.current].map(([key, el]) => [
        key,
        el.getBoundingClientRect(),
      ]),
    );
  }

  function register(key: string) {
    return (el: HTMLElement | null) => {
      if (el) elements.current.set(key, el);
      else elements.current.delete(key);
    };
  }

  function start(
    e: ReactPointerEvent,
    item: T,
    onDrop: (hit: DropHit | null) => void,
  ) {
    if (e.button !== 0 || (e.target as Element).closest(IGNORED_TARGETS))
      return;
    const origin = { x: e.clientX, y: e.clientY };
    const source = (e.target as Element).closest(
      '[data-drop-index]:not([data-drop-exact])',
    );
    let active = false;
    let targets: Target[] = [];
    let hoverKey = '';

    const move = (ev: PointerEvent) => {
      if (!active) {
        if (
          Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) <
          DRAG_THRESHOLD
        )
          return;
        active = true;
        document.body.classList.add(DRAGGING_CLASS);
        playSound('click');
      }
      targets = captureTargets(source);
      const hover = hitIn(targets, ev.clientX, ev.clientY);
      const key = hover ? `${hover.zone}:${hover.index ?? ''}` : '';
      if (key !== hoverKey) {
        hoverKey = key;
        snapshot();
        if (hover) playSound('fortify');
      }
      setDrag({ item, x: ev.clientX, y: ev.clientY, hover });
    };

    const finish = (ev: PointerEvent | null) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (!active) return;
      active = false;
      document.body.classList.remove(DRAGGING_CLASS);
      setDrag(null);
      swallowNextClick();
      if (!ev) return;
      const hit = hitIn(targets, ev.clientX, ev.clientY);
      if (hit) playSound('select');
      onDrop(hit);
    };
    const up = (ev: PointerEvent) => finish(ev);
    const cancel = () => finish(null);

    endDrag.current = () => finish(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  return { drag, start, snapshot, register };
}
