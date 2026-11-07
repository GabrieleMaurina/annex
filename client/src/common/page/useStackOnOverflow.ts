import { useLayoutEffect, type RefObject } from 'react';

const STACKED_CLASS = 'hero-top-stacked';

function useStackOnOverflow(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      element.classList.remove(STACKED_CLASS);
      element.classList.toggle(
        STACKED_CLASS,
        element.scrollWidth > element.clientWidth,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    Array.from(element.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [ref]);
}

export default useStackOnOverflow;
