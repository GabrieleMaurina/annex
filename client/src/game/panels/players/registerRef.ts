import type { MutableRefObject } from 'react';

export function registerRef(
  refs: MutableRefObject<Map<number, HTMLElement>>,
  id: number,
  element: HTMLElement | null,
) {
  if (element) refs.current.set(id, element);
  else refs.current.delete(id);
}
