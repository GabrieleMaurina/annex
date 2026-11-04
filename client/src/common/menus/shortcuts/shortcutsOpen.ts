let open = false;
const listeners = new Set<() => void>();

export function getShortcutsOpen(): boolean {
  return open;
}

export function setShortcutsOpen(value: boolean) {
  open = value;
  listeners.forEach((listener) => listener());
}

export function subscribeShortcutsOpen(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
