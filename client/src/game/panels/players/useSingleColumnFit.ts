import type { RefObject } from 'react';
import { useLayoutEffect, useState } from 'react';

function singleColumnExtra(panel: HTMLElement): number {
  let extra = 0;
  panel.querySelectorAll<HTMLElement>('[data-split]').forEach((element) => {
    const items = Array.from(element.children).filter(
      (child) => (child as HTMLElement).offsetHeight > 0,
    ) as HTMLElement[];
    const gap = parseFloat(getComputedStyle(element).rowGap) || 0;
    const single =
      items.reduce((sum, item) => sum + item.offsetHeight, 0) +
      Math.max(0, items.length - 1) * gap;
    extra += single - element.offsetHeight;
  });
  return extra;
}

function fitsInViewport(
  panel: HTMLElement,
  scroll: HTMLElement,
  grid: HTMLElement,
): boolean {
  const first = grid.firstElementChild as HTMLElement | null;
  if (!first) return true;
  const count = grid.childElementCount;
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
  const singleHeight = count * first.offsetHeight + (count - 1) * gap;
  const panelStyle = getComputedStyle(panel);
  const margins =
    parseFloat(panelStyle.marginTop) + parseFloat(panelStyle.marginBottom);
  const total =
    panel.offsetHeight -
    scroll.offsetHeight +
    scroll.scrollHeight -
    grid.offsetHeight +
    singleHeight +
    singleColumnExtra(panel);
  return total <= window.innerHeight - margins;
}

export function useSingleColumnFit(
  enabled: boolean,
  panelRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  gridRef: RefObject<HTMLElement | null>,
): boolean {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const scroll = scrollRef.current;
    const grid = gridRef.current;
    if (!enabled || !panel || !scroll || !grid) return;

    const measure = () => setFits(fitsInViewport(panel, scroll, grid));

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(scroll);
    observer.observe(grid);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled, panelRef, scrollRef, gridRef]);

  return fits;
}
