import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';
import type { PlayersLevel } from './playerLevels';
import { LEVELS } from './playerLevels';

function overflows(panel: HTMLElement, scroll: HTMLElement): boolean {
  const panelStyle = getComputedStyle(panel);
  const margins =
    parseFloat(panelStyle.marginLeft) + parseFloat(panelStyle.marginRight);
  return (
    scroll.scrollHeight > scroll.clientHeight + 1 ||
    panel.offsetWidth > window.innerWidth - margins
  );
}

export function useFittingLevel(
  enabled: boolean,
  contentKey: string,
  panelRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
): PlayersLevel {
  const [index, setIndex] = useState(0);
  const [resizes, setResizes] = useState(0);
  const key = `${enabled}:${contentKey}:${resizes}`;
  const [seenKey, setSeenKey] = useState(key);

  if (seenKey !== key) {
    setSeenKey(key);
    setIndex(0);
  }

  useEffect(() => {
    const onResize = () => setResizes((count) => count + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    if (!enabled) return;
    const panel = panelRef.current;
    const scroll = scrollRef.current;
    if (!panel || !scroll) return;
    if (index < LEVELS.length - 1 && overflows(panel, scroll))
      setIndex(index + 1);
  }, [enabled, key, index, panelRef, scrollRef]);

  return LEVELS[index];
}
