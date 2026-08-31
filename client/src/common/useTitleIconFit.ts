import { useLayoutEffect, useRef, useState } from 'react';

export function useTitleIconFit(text: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const iconWidthRef = useRef(0);
  const [hideIcons, setHideIcons] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function check() {
      const title = textRef.current;
      if (!container || !title) return;
      const icon = container.querySelector<HTMLElement>('.title-icon');
      if (icon) iconWidthRef.current = icon.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
      const needed = title.scrollWidth + 2 * (iconWidthRef.current + gap);
      setHideIcons(needed > container.clientWidth);
    }
    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  return { containerRef, textRef, hideIcons };
}
