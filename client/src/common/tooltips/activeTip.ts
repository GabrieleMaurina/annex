let closeActiveTip: (() => void) | null = null;

export function closeAllTips() {
  closeActiveTip?.();
  closeActiveTip = null;
}

export function setActiveTip(close: () => void) {
  closeActiveTip = close;
}

export function clearActiveTip(close: () => void) {
  if (closeActiveTip === close) closeActiveTip = null;
}
